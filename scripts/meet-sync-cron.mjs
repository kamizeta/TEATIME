const intervalSeconds = Number(process.env.MEET_SYNC_INTERVAL_SECONDS || 300)
const baseUrl = (process.env.APP_INTERNAL_URL || process.env.APP_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
const cronSecret = process.env.CRON_SECRET || ''
const runOnce = process.argv.includes('--once')

if (!cronSecret || cronSecret.length < 32) {
  throw new Error('CRON_SECRET_MISSING_OR_TOO_SHORT')
}
if (!Number.isInteger(intervalSeconds) || intervalSeconds < 60) {
  throw new Error('MEET_SYNC_INTERVAL_SECONDS_INVALID')
}

async function syncMeetClasses() {
  const response = await fetch(`${baseUrl}/api/jobs/meet-sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`MEET_SYNC_FAILED_${response.status}: ${JSON.stringify(payload)}`)
  console.log(JSON.stringify({ job: 'meet-sync', at: new Date().toISOString(), processed: payload.processed || 0 }))
}

async function main() {
  do {
    try {
      await syncMeetClasses()
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'MEET_SYNC_FAILED')
      if (runOnce) process.exitCode = 1
    }
    if (!runOnce) await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000))
  } while (!runOnce)
}

main()
