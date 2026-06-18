export function nowIso() {
  return new Date().toISOString()
}

export function hoursBetween(dateA: Date, dateB: Date) {
  return (dateA.getTime() - dateB.getTime()) / (1000 * 60 * 60)
}
