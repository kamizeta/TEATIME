import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'Asistencia Teatime',
  description: 'Asistencia de clases de idiomas',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: 20 }}>
          <header style={{ marginBottom: 16 }}>
            <strong>Asistencia Teatime</strong> | <Link href="/">Inicio</Link>
          </header>
          {children}
        </div>
      </body>
    </html>
  )
}
