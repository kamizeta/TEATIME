import { prisma } from '@/lib/prisma'

export default async function AdminCalendar() {
  const events = await prisma.classEvent.findMany({
    orderBy: { startAt: 'asc' },
    include: { enrollments: { include: { student: { include: { user: true } } } } },
  })

  return (
    <div>
      <h1>Calendario operativo</h1>
      <ul>
        {events.map((e) => (
          <li key={e.id}>
            {new Date(e.startAt).toLocaleString()} | {e.title} | alumnos: {e.enrollments.length} | Meet: {e.meetUrl || 'sin link'}
          </li>
        ))}
      </ul>
    </div>
  )
}
