'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { AppRole } from '@/lib/navigation'
import { roleLabels } from '@/lib/display-labels'

type NavItem = {
  href: string
  label: string
  description: string
}

export function AppSidebar({ nav, role }: { nav: NavItem[]; role: AppRole }) {
  const pathname = usePathname()

  return (
    <aside className="sidebar">
      <div className="sidebar-heading">
        <span>Menú principal</span>
        <strong>{roleLabels[role]}</strong>
      </div>
      <nav className="sidebar-nav" aria-label="Navegación principal">
        {nav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={isActive ? 'sidebar-link sidebar-link-active' : 'sidebar-link'}
              aria-current={isActive ? 'page' : undefined}
            >
              <span>{item.label}</span>
              <small>{item.description}</small>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
