# Asistencia Teatime

## Arranque rápido (MVP)

1. `npm install`
2. `cp .env.example .env`
3. Levanta PostgreSQL local con `docker compose up -d`
4. Ajusta `JWT_SECRET` en `.env`
5. `npm run db:migrate -- --name booking_foundation`
6. `npm run db:seed`
7. `npm run dev`

Credenciales demo:
- admin@academy.test / admin123
- profesor@academy.test / prof123
- alumno@academy.test / alumno123
- staff@academy.test / staff123

Endpoints importantes:
- POST `/api/integrations/calendar/sync`
- PATCH `/api/classes/:id/attendance`
- POST `/api/classes/:id/cancel`
- GET `/api/reports/attendance/export`
