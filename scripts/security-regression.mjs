const baseUrl = process.env.SECURITY_TEST_BASE_URL || process.env.APP_BASE_URL || 'http://localhost:3002'
const portalPassword = process.env.TEST_GLOBAL_PORTAL_PASSWORD || 'teatime123'
const ownerTeacherEmail = process.env.SECURITY_TEST_OWNER_TEACHER || 'profesor@academy.test'
const otherTeacherEmail = process.env.SECURITY_TEST_OTHER_TEACHER || 'adriana@teatime.com'
const studentEmail = process.env.SECURITY_TEST_STUDENT || 'alumno@academy.test'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function login(email) {
  const body = new FormData()
  body.set('email', email)
  body.set('password', portalPassword)
  const response = await fetch(`${baseUrl}/api/login`, { method: 'POST', body })
  const result = await response.json().catch(() => ({}))
  assert(response.ok && result.ok, `No se pudo iniciar sesión como ${email}: ${JSON.stringify(result)}`)
  const cookie = response.headers.get('set-cookie')?.split(';')[0]
  assert(cookie, `No se recibió cookie de sesión para ${email}`)
  return cookie
}

async function getJson(path, cookie) {
  const response = await fetch(`${baseUrl}${path}`, { headers: cookie ? { cookie } : {} })
  return { response, body: await response.json().catch(() => ({})) }
}

async function main() {
  const protectedPaths = [
    { path: '/api/classes', method: 'GET', expectedStatus: 401 },
    { path: '/api/reports/attendance/export', method: 'GET', expectedStatus: 401 },
    { path: '/api/reports/packages/export', method: 'GET', expectedStatus: 401 },
    { path: '/api/jobs/meet-sync', method: 'POST', expectedStatus: 403 },
  ]
  for (const item of protectedPaths) {
    const response = item.method === 'POST'
      ? await fetch(`${baseUrl}${item.path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      : (await getJson(item.path)).response
    assert(response.status === item.expectedStatus, `Ruta pública inesperada: ${item.path} devolvió ${response.status}`)
    console.log(`OK ${item.expectedStatus} ${item.path}`)
  }

  const ownerCookie = await login(ownerTeacherEmail)
  const studentCookie = await login(studentEmail)
  const otherTeacherCookie = await login(otherTeacherEmail)
  const owner = await getJson('/api/classes', ownerCookie)
  const student = await getJson('/api/classes', studentCookie)

  assert(owner.response.ok, 'El profesor propietario no puede consultar sus clases')
  assert(student.response.ok, 'El alumno no puede consultar sus clases')
  assert(owner.body.events.every((event) => event.teacher.user.email === ownerTeacherEmail), 'El profesor recibió clases ajenas')
  assert(student.body.events.every((event) => event.enrollments.length <= 1 && event.enrollments.every((item) => item.student.user.email === studentEmail)), 'El alumno recibió matrículas ajenas')
  assert(!JSON.stringify([owner.body.events, student.body.events]).includes('"password"'), 'La API expuso un hash de contraseña')
  console.log('OK aislamiento por profesor, alumno y redacción de contraseñas')

  const target = owner.body.events.find((event) => event.enrollments.length)
  assert(target, 'No hay clase con matrícula para verificar acceso cruzado de asistencia')
  const packageId = target.enrollments[0].packageId
  const packageRead = await getJson(`/api/packages/${packageId}/adjust`)
  assert(packageRead.response.status === 401, `Un paquete fue expuesto sin sesión: ${packageRead.response.status}`)
  const packageMutation = await fetch(`${baseUrl}/api/packages/${packageId}/adjust`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usedHours: 0 }),
  })
  assert(packageMutation.status === 401, `Un saldo pudo alterarse sin sesión: ${packageMutation.status}`)
  console.log('OK paquete protegido y ledger no alterable por HTTP')
  const attendance = await fetch(`${baseUrl}/api/classes/${target.id}/attendance`, {
    method: 'PATCH',
    headers: { cookie: otherTeacherCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: target.enrollments[0].student.id, status: 'attended' }),
  })
  assert(attendance.status === 403, `Un profesor ajeno pudo intentar modificar asistencia: ${attendance.status}`)
  console.log('OK 403 asistencia de clase ajena')

  console.log(`Pruebas de seguridad pasaron contra ${baseUrl}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
