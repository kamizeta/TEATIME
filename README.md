# Asistencia Teatime

## Arranque rápido (MVP)

1. `npm install`
2. Copia `.env.example` a `.env` y configura `DATABASE_URL` y `JWT_SECRET`.
3. `npx prisma migrate dev --name init`
4. `npx ts-node --transpile-only prisma/seed.ts`
5. `npm run dev`

Credenciales demo:
- admin@academy.test / admin123
- profesor@academy.test / prof123
- alumno@academy.test / alumno123

Endpoints importantes:
- POST `/api/integrations/calendar/sync`
- PATCH `/api/classes/:id/attendance`
- POST `/api/classes/:id/cancel`
- GET `/api/reports/attendance/export`
