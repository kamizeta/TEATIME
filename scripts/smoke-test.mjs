const baseUrl = process.env.SMOKE_BASE_URL || process.env.APP_BASE_URL || 'http://localhost:3002'
const email = process.env.SMOKE_EMAIL || 'admin@academy.test'
const password = process.env.SMOKE_PASSWORD || 'admin123'

const routes = [
  '/api/health',
  '/admin/dashboard',
  '/admin/calendar',
  '/admin/crm',
  '/admin/incidents',
  '/admin/weekly-closing',
  '/admin/templates',
  '/admin/users',
  '/admin/audit',
  '/admin/notifications',
  '/admin/reports',
]

const protectedApiRoutes = ['/api/readiness']

function cookieHeaderFrom(response) {
  const setCookie = response.headers.get('set-cookie')
  if (!setCookie) return ''
  return setCookie
    .split(',')
    .map((part) => part.split(';')[0].trim())
    .filter(Boolean)
    .join('; ')
}

async function main() {
  const loginForm = new FormData()
  loginForm.set('email', email)
  loginForm.set('password', password)

  const loginResponse = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    body: loginForm,
  })
  const loginBody = await loginResponse.json().catch(() => ({}))
  if (!loginResponse.ok || !loginBody.ok) {
    throw new Error(`Login failed: ${loginResponse.status} ${JSON.stringify(loginBody)}`)
  }

  const cookie = cookieHeaderFrom(loginResponse)
  if (!cookie) throw new Error('Login did not return a session cookie')

  const failures = []
  for (const route of routes) {
    const response = await fetch(`${baseUrl}${route}`, {
      headers: route.startsWith('/api/health') ? {} : { cookie },
    })
    const ok = response.status >= 200 && response.status < 400
    console.log(`${ok ? 'OK' : 'FAIL'} ${response.status} ${route}`)
    if (!ok) failures.push(`${route} -> ${response.status}`)
  }

  for (const route of protectedApiRoutes) {
    const response = await fetch(`${baseUrl}${route}`, { headers: { cookie } })
    const body = await response.json().catch(() => ({}))
    const ok = response.status >= 200 && response.status < 400 && body.ok === true
    console.log(`${ok ? 'OK' : 'FAIL'} ${response.status} ${route} ok=${Boolean(body.ok)}`)
    if (!ok) failures.push(`${route} -> ${response.status}`)
  }

  if (failures.length) {
    throw new Error(`Smoke test failed:\n${failures.join('\n')}`)
  }

  console.log(`Smoke test passed against ${baseUrl}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
