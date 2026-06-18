export async function sendWhatsAppNotification(target: string, template: string, variables: Record<string, string>) {
  if (!process.env.WHATSAPP_API_URL || !process.env.WHATSAPP_TOKEN) {
    return { ok: false, error: 'WHATSAPP_NOT_CONFIGURED' }
  }

  const resp = await fetch(process.env.WHATSAPP_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to: target, template, variables }),
  })

  return { ok: resp.ok }
}
