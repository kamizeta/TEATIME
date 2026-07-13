-- Keep the earliest active duplicate and retire subsequent copies. Existing classes are preserved.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "teacherId", weekday, "startLocalTime", "endLocalTime", "durationMinutes", "classType", capacity
      ORDER BY "createdAt" ASC, id ASC
    ) AS position
  FROM "TeacherAvailabilityBlock"
  WHERE "isActive" = true
)
UPDATE "TeacherAvailabilityBlock"
SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE id IN (SELECT id FROM ranked WHERE position > 1);

CREATE UNIQUE INDEX "TeacherAvailabilityBlock_active_slot_unique"
ON "TeacherAvailabilityBlock" ("teacherId", weekday, "startLocalTime", "endLocalTime", "durationMinutes", "classType", capacity)
WHERE "isActive" = true;
