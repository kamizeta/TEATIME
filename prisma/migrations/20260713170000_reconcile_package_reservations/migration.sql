-- Reconcile the cached package reservation totals with active class enrollments.
-- ClassEnrollment is the detailed source of truth; HourPackage keeps the aggregate
-- used by booking availability checks.
UPDATE "HourPackage" AS package
SET
  "reservedMinutes" = totals."reservedMinutes",
  "reservedHours" = CEIL(totals."reservedMinutes" / 60.0)::INTEGER
FROM (
  SELECT
    packages.id AS "packageId",
    COALESCE(SUM(
      CASE
        WHEN enrollment.status = 'CONFIRMED'
          AND class.status IN ('SCHEDULED', 'RESERVED')
        THEN enrollment."reservedMinutes"
        ELSE 0
      END
    ), 0)::INTEGER AS "reservedMinutes"
  FROM "HourPackage" AS packages
  LEFT JOIN "ClassEnrollment" AS enrollment ON enrollment."packageId" = packages.id
  LEFT JOIN "ClassEvent" AS class ON class.id = enrollment."classEventId"
  GROUP BY packages.id
) AS totals
WHERE package.id = totals."packageId";
