import type { FastifyBaseLogger } from 'fastify'
import { listEvents } from '../repositories/events.js'
import {
  markReminderSent,
  wasReminderSent,
} from '../repositories/notifications.js'
import { notifyEventReminder } from './event-notifications.js'
import type { EventRecord } from '../types/events.js'

const REMINDER_WINDOW_MS = 5 * 60 * 1000
const REMINDER_TOLERANCE_MS = 60 * 1000
const TICK_MS = 60 * 1000

function formatEventDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}.${month}.${year}`
}

function parseEventStart(event: EventRecord): Date | null {
  if (event.allDay)
    return null

  const dateMatch = event.eventDate.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  const timeMatch = event.time.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!dateMatch || !timeMatch)
    return null

  return new Date(
    Number(dateMatch[3]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[1]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    0,
    0,
  )
}

function processReminders(now: Date, logger?: FastifyBaseLogger): void {
  const dates = [
    formatEventDate(now),
    formatEventDate(new Date(now.getTime() + 24 * 60 * 60 * 1000)),
  ]

  const events: EventRecord[] = []
  for (const eventDate of dates) {
    events.push(...listEvents({ eventDate }))
  }

  for (const event of events) {
    const start = parseEventStart(event)
    if (!start)
      continue

    const diff = start.getTime() - now.getTime()
    if (Math.abs(diff - REMINDER_WINDOW_MS) > REMINDER_TOLERANCE_MS)
      continue

    const participants = event.participantIds
    const pending = participants.filter(
      id => !wasReminderSent(event.id, id),
    )
    if (!pending.length)
      continue

    notifyEventReminder(event, pending)
    for (const externalUserId of pending)
      markReminderSent(event.id, externalUserId)

    logger?.info({ eventId: event.id, count: pending.length }, 'event reminders sent')
  }
}

export function startEventReminderWorker(logger?: FastifyBaseLogger): () => void {
  const tick = () => {
    try {
      processReminders(new Date(), logger)
    } catch (error) {
      logger?.error({ err: error }, 'event reminder worker failed')
    }
  }

  tick()
  const timer = setInterval(tick, TICK_MS)
  return () => clearInterval(timer)
}
