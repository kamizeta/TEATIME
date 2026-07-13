ALTER TABLE "HourPackage" ADD COLUMN "classLanguage" TEXT NOT NULL DEFAULT 'Inglés';
ALTER TABLE "ClassEvent" ADD COLUMN "classLanguage" TEXT NOT NULL DEFAULT 'Inglés';

UPDATE "ClassEvent" AS event
SET "title" = 'Clase ' || event."classLanguage" || ' TEA TIME - ' ||
  COALESCE((
    SELECT string_agg(user_record."name", ', ' ORDER BY enrollment."id")
    FROM "ClassEnrollment" AS enrollment
    INNER JOIN "Student" AS student ON student."id" = enrollment."studentId"
    INNER JOIN "User" AS user_record ON user_record."id" = student."userId"
    WHERE enrollment."classEventId" = event."id"
  ), 'Sin alumno asignado') ||
  ' - Prof. ' || teacher_user."name"
FROM "Teacher" AS teacher
INNER JOIN "User" AS teacher_user ON teacher_user."id" = teacher."userId"
WHERE event."teacherId" = teacher."id";
