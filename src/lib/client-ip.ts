/**
 * Caddy is the only public entrypoint and overwrites X-Real-IP with its peer IP.
 * Do not trust X-Forwarded-For here: clients can forge it and bypass rate limits.
 */
export function getTrustedClientIp(headers: Headers) {
  return headers.get('x-real-ip')?.trim().slice(0, 64) || 'local'
}
