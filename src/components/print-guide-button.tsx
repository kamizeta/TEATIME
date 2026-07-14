'use client'

export function PrintGuideButton() {
  return <button type="button" className="button-ghost" onClick={() => window.print()}>Imprimir o guardar PDF</button>
}
