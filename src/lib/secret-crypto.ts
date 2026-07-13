import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const PREFIX = 'enc:v1'

function getEncryptionKey() {
  const raw = process.env.APP_ENCRYPTION_KEY
  if (!raw) throw new Error('APP_ENCRYPTION_KEY_MISSING')

  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('APP_ENCRYPTION_KEY_INVALID')
  return key
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${PREFIX}:${iv.toString('base64url')}:${authTag.toString('base64url')}:${ciphertext.toString('base64url')}`
}

export function decryptSecret(value: string) {
  const [prefix, version, ivRaw, authTagRaw, ciphertextRaw] = value.split(':')
  if (`${prefix}:${version}` !== PREFIX || !ivRaw || !authTagRaw || !ciphertextRaw) {
    throw new Error('SECRET_NOT_ENCRYPTED_RECONNECT_REQUIRED')
  }

  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivRaw, 'base64url'))
  decipher.setAuthTag(Buffer.from(authTagRaw, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}
