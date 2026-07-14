'use client'

import Link from 'next/link'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ActionIcon = 'save' | 'invite' | 'copy' | 'reset' | 'key' | 'detail' | 'meet' | 'cancel' | 'delete' | 'sync' | 'download'
type Tone = 'default' | 'primary' | 'danger'

function Icon({ name }: { name: ActionIcon }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const paths: Record<ActionIcon, ReactNode> = {
    save: <><path {...common} d="M5 3h11l3 3v15H5z" /><path {...common} d="M8 3v6h8V3" /><path {...common} d="M8 21v-7h8v7" /></>,
    invite: <><rect {...common} x="3" y="5" width="18" height="14" rx="2" /><path {...common} d="m3 7 9 6 9-6" /></>,
    copy: <><rect {...common} x="9" y="9" width="11" height="11" rx="2" /><path {...common} d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></>,
    reset: <><path {...common} d="M20 7h-5V2" /><path {...common} d="M20 7a8 8 0 0 0-14-2L4 7" /><path {...common} d="M4 17h5v5" /><path {...common} d="M4 17a8 8 0 0 0 14 2l2-2" /></>,
    key: <><circle {...common} cx="8" cy="15" r="4" /><path {...common} d="m11 12 9-9" /><path {...common} d="m17 6 2 2" /></>,
    detail: <><path {...common} d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle {...common} cx="12" cy="12" r="2.5" /></>,
    meet: <><rect {...common} x="3" y="6" width="13" height="12" rx="2" /><path {...common} d="m16 10 5-3v10l-5-3" /></>,
    cancel: <><circle {...common} cx="12" cy="12" r="9" /><path {...common} d="m9 9 6 6m0-6-6 6" /></>,
    delete: <><path {...common} d="M4 7h16m-10 4v6m4-6v6M9 7l1-3h4l1 3m-9 0 1 14h10l1-14" /></>,
    sync: <><path {...common} d="M20 7h-5V2" /><path {...common} d="M20 7a8 8 0 0 0-14-2L4 7" /><path {...common} d="M4 17h5v5" /><path {...common} d="M4 17a8 8 0 0 0 14 2l2-2" /></>,
    download: <><path {...common} d="M12 3v12m0 0 4-4m-4 4-4-4" /><path {...common} d="M4 20h16" /></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

type SharedProps = {
  icon: ActionIcon
  label: string
  tone?: Tone
  className?: string
}

export function ActionIconButton({ icon, label, tone = 'default', className = '', ...props }: SharedProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button {...props} className={`icon-action-button icon-action-${tone} ${className}`.trim()} aria-label={label} title={label}>
      <Icon name={icon} />
    </button>
  )
}

export function ActionIconLink({ href, icon, label, tone = 'default', className = '' }: SharedProps & { href: string }) {
  return (
    <Link href={href} className={`icon-action-button icon-action-${tone} ${className}`.trim()} aria-label={label} title={label}>
      <Icon name={icon} />
    </Link>
  )
}

export function ActionIconExternalLink({ href, icon, label, tone = 'default', className = '' }: SharedProps & { href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`icon-action-button icon-action-${tone} ${className}`.trim()} aria-label={label} title={label}>
      <Icon name={icon} />
    </a>
  )
}
