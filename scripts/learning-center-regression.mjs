import { randomBytes } from 'crypto'
import bcrypt from 'bcrypt'
import { PrismaClient, UserRole } from '@prisma/client'

const baseUrl = process.env.LEARNING_TEST_BASE_URL || process.env.APP_BASE_URL || 'http://127.0.0.1:3000'
const prisma = new PrismaClient()
const suffix = randomBytes(6).toString('hex')
const password = `Guia-${suffix}-2026`
const users = [
  { role: UserRole.ADMIN, guide: 'operacion' },
  { role: UserRole.STAFF, guide: 'operacion' },
  { role: UserRole.TEACHER, guide: 'profesor' },
  { role: UserRole.STUDENT, guide: 'alumno' },
]
const createdIds = []

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function cookieFrom(response) {
  return response.headers.get('set-cookie')?.split(';')[0] || ''
}

async function login(email) {
  const form = new FormData()
  form.set('email', email)
  form.set('password', password)
  const response = await fetch(`${baseUrl}/api/login`, { method: 'POST', body: form })
  const body = await response.json().catch(() => ({}))
  assert(response.ok && body.ok, `No se pudo iniciar sesión como ${email}: ${JSON.stringify(body)}`)
  const cookie = cookieFrom(response)
  assert(cookie, `No se recibió sesión para ${email}`)
  return cookie
}

try {
  const hash = await bcrypt.hash(password, 10)
  for (const item of users) {
    const user = await prisma.user.create({
      data: {
        name: `QA aprendizaje ${item.role}`,
        email: `qa.learning.${item.role.toLowerCase()}.${suffix}@invalid.test`,
        password: hash,
        role: item.role,
        isActive: true,
      },
    })
    createdIds.push(user.id)
    const cookie = await login(user.email)
    const guide = await fetch(`${baseUrl}/ayuda/${item.guide}`, { headers: { cookie }, redirect: 'manual' })
    const html = await guide.text()
    assert(guide.status === 200, `${item.role} no pudo abrir /ayuda/${item.guide}: ${guide.status}`)
    assert(html.includes('Tu primer día con TEATIME Ops'), `${item.role} no recibió la guía de aprendizaje`)
    assert(html.includes('Conoce TEATIME Ops a tu ritmo'), `${item.role} no recibió la tarjeta de primer ingreso`)
    console.log(`OK ${item.role} -> /ayuda/${item.guide}`)
  }

  const teacher = users.find((item) => item.role === UserRole.TEACHER)
  const teacherId = createdIds[users.indexOf(teacher)]
  const teacherEmail = `qa.learning.teacher.${suffix}@invalid.test`
  const teacherCookie = await login(teacherEmail)
  const denied = await fetch(`${baseUrl}/ayuda/alumno`, { headers: { cookie: teacherCookie }, redirect: 'manual' })
  assert(denied.status >= 300 && denied.status < 400, `Profesor pudo abrir guía de alumno: ${denied.status}`)
  assert(denied.headers.get('location')?.includes('/teacher/today'), 'La redirección de guía no respetó el rol')
  console.log('OK aislamiento de guías por rol')

  await prisma.learningProgress.upsert({
    where: { userId_guideKey_lessonKey: { userId: teacherId, guideKey: 'profesor', lessonKey: 'agenda' } },
    update: { completedAt: new Date(), contentVersion: '2026.07' },
    create: { userId: teacherId, guideKey: 'profesor', lessonKey: 'agenda', completedAt: new Date(), contentVersion: '2026.07' },
  })
  const progress = await prisma.learningProgress.findUnique({ where: { userId_guideKey_lessonKey: { userId: teacherId, guideKey: 'profesor', lessonKey: 'agenda' } } })
  assert(progress?.completedAt, 'No se pudo persistir el progreso de aprendizaje')
  console.log('OK progreso persistente por usuario')
} finally {
  if (createdIds.length) await prisma.user.deleteMany({ where: { id: { in: createdIds } } })
  await prisma.$disconnect()
}
