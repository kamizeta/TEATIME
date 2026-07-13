import { createHmac, timingSafeEqual } from 'crypto'

const MINIMUM_SECRET_LENGTH = 32

export function requireSecret(name: string) {
  const value = process.env[name]
  if (!value || value.length < MINIMUM_SECRET_LENGTH) {
    throw new Error(`${name}_MISSING_OR_TOO_SHORT`)
  }
  return value
}

export function getJwtSecret() {
  return requireSecret('JWT_SECRET')
}

export function getSlotTokenSecret() {
  return process.env.SLOT_TOKEN_SECRET && process.env.SLOT_TOKEN_SECRET.length >= MINIMUM_SECRET_LENGTH
    ? process.env.SLOT_TOKEN_SECRET
    : getJwtSecret()
}

export function signValue(value: string, secret = getSlotTokenSecret()) {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

export function isSignedValueValid(value: string, signature: string, secret = getSlotTokenSecret()) {
  const expected = Buffer.from(signValue(value, secret))
  const received = Buffer.from(signature)
  return expected.length === received.length && timingSafeEqual(expected, received)
}
