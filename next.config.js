/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === 'production'

const nextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    }
  },
  async headers() {
    const securityHeaders = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "object-src 'none'",
          `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"}`,
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com",
          "img-src 'self' data: blob:",
          "connect-src 'self' https://www.googleapis.com https://oauth2.googleapis.com",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          'upgrade-insecure-requests',
          'block-all-mixed-content',
        ].join('; '),
      },
    ]
    if (isProduction) securityHeaders.push({ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' })

    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
