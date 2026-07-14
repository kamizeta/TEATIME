'use client'

import { deactivateAvailabilityBlockAction } from '@/lib/actions/booking'
import { ActionIconButton } from '@/components/action-icon-button'

type AvailabilityDeleteButtonProps = {
  blockId: string
  redirectPath: string
}

export function AvailabilityDeleteButton({ blockId, redirectPath }: AvailabilityDeleteButtonProps) {
  return (
    <form
      action={deactivateAvailabilityBlockAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          '¿Quitar este bloque de disponibilidad? Dejará de aparecer para nuevas reservas. Las clases ya programadas no se cancelan.',
        )

        if (!confirmed) event.preventDefault()
      }}
    >
      <input type="hidden" name="blockId" value={blockId} />
      <input type="hidden" name="redirectPath" value={redirectPath} />
      <ActionIconButton type="submit" icon="delete" tone="danger" label="Eliminar disponibilidad" />
    </form>
  )
}
