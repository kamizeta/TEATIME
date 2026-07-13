'use client'

import { type ButtonHTMLAttributes, useEffect, useRef, useState } from 'react'

type DirtySubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  ready?: boolean
}

function formSignature(form: HTMLFormElement) {
  return Array.from(form.elements)
    .filter(
      (element): element is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
        element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement,
    )
    .filter((element) => element.type !== 'hidden' && !element.disabled)
    .map((element) => {
      if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
        return `${element.name}:${element.type}:${element.checked}`
      }

      return `${element.name}:${element.type}:${element.value}`
    })
    .join('|')
}

export function DirtySubmitButton({
  children,
  className = '',
  disabled,
  ready = true,
  type = 'submit',
  ...props
}: DirtySubmitButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const baselineRef = useRef('')
  const [canSubmit, setCanSubmit] = useState(false)

  useEffect(() => {
    const form = buttonRef.current?.form || buttonRef.current?.closest('form')
    if (!form) return

    baselineRef.current = formSignature(form)

    const updateState = () => {
      const changed = formSignature(form) !== baselineRef.current
      setCanSubmit(changed && form.checkValidity())
    }

    const handleReset = () => window.setTimeout(updateState, 0)

    form.addEventListener('input', updateState)
    form.addEventListener('change', updateState)
    form.addEventListener('reset', handleReset)
    updateState()

    return () => {
      form.removeEventListener('input', updateState)
      form.removeEventListener('change', updateState)
      form.removeEventListener('reset', handleReset)
    }
  }, [])

  const isEnabled = canSubmit && ready && !disabled

  return (
    <button
      {...props}
      ref={buttonRef}
      type={type}
      disabled={!isEnabled}
      aria-disabled={!isEnabled}
      className={`${isEnabled ? 'button-primary' : 'button-ghost'} ${className}`.trim()}
    >
      {children}
    </button>
  )
}
