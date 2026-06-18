import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.warn('DATABASE_URL no está definida en .env')
}

export const prisma = global.__prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma
}
