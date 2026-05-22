import type { FastifyPluginAsync } from 'fastify'
import { findEventById } from '../repositories/events.js'
import { resolveUserAccess } from '../utils/event-access.js'
import { canEditEvent, canViewEvent } from '../services/event-permissions.js'
import {
  addAttachmentFromUpload,
  deleteAttachment,
  findAttachmentById,
} from '../repositories/attachments.js'
import {
  assertAllowedUpload,
  openStoredFile,
  UploadValidationError,
} from '../services/file-storage.js'
import {
  buildAttachmentDeleteMeta,
  buildAttachmentUploadFailedMeta,
  buildAttachmentUploadMeta,
} from '../services/attachment-activity-meta.js'
import { getRequestIp, logActivity } from '../services/activity-log.js'
import { jwtActor } from '../utils/request-context.js'

export const attachmentsRoutes: FastifyPluginAsync = async app => {
  app.post(
    '/events/:eventId/attachments',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      let uploadFileName: string | undefined
      try {
        const profile = resolveUserAccess(request)
        if (!profile) {
          return reply.status(401).send({ success: false, error: 'Unauthorized' })
        }

        const eventId = Number((request.params as { eventId: string }).eventId)
        if (!Number.isInteger(eventId) || eventId <= 0) {
          return reply.status(400).send({ success: false, error: 'Invalid event id' })
        }

        const event = findEventById(eventId)
        if (!event || !canViewEvent(profile, event)) {
          return reply.status(404).send({ success: false, error: 'Event not found' })
        }
        if (!canEditEvent(profile, event)) {
          return reply.status(403).send({ success: false, error: 'Forbidden' })
        }

        const file = await request.file({
          limits: { fileSize: app.config.env.UPLOAD_MAX_BYTES },
        })

        if (!file) {
          return reply.status(400).send({ success: false, error: 'File is required' })
        }

        uploadFileName = file.filename
        const buffer = await file.toBuffer()
        if (!buffer.length) {
          return reply.status(400).send({ success: false, error: 'Empty file' })
        }

        try {
          assertAllowedUpload(file.mimetype, file.filename)
        } catch (error) {
          if (error instanceof UploadValidationError) {
            return reply.status(400).send({ success: false, error: error.message })
          }
          throw error
        }

        const attachment = await addAttachmentFromUpload(
          app.config.env,
          eventId,
          file.filename,
          file.mimetype,
          buffer,
        )

        const actor = jwtActor(request)
        const uploadLog = buildAttachmentUploadMeta(
          attachment.name,
          attachment.sizeLabel,
          event.topic,
          eventId,
        )
        logActivity(app.config.env, {
          level: 'info',
          category: 'attachment',
          action: 'attachment.upload',
          message: uploadLog.message,
          userId: actor?.userId,
          userLogin: actor?.userLogin,
          userName: actor?.userName,
          entityType: 'event',
          entityId: eventId,
          ipAddress: getRequestIp(request),
          meta: uploadLog.meta,
        }, request.log)

        return reply.status(201).send({
          success: true,
          attachment: {
            id: attachment.id,
            name: attachment.name,
            sizeLabel: attachment.sizeLabel,
            mimeType: attachment.mimeType,
          },
        })
      } catch (error) {
        const err = error as { code?: string, message?: string }
        if (err.code === 'FST_REQ_FILE_TOO_LARGE') {
          const eventId = Number((request.params as { eventId: string }).eventId)
          const event = Number.isInteger(eventId) ? findEventById(eventId) : null
          const actor = jwtActor(request)
          const failLog = buildAttachmentUploadFailedMeta(
            uploadFileName,
            event?.topic ?? null,
            event?.id ?? null,
          )
          logActivity(app.config.env, {
            level: 'error',
            category: 'attachment',
            action: 'attachment.upload_failed',
            message: failLog.message,
            userId: actor?.userId,
            userLogin: actor?.userLogin,
            userName: actor?.userName,
            entityType: 'event',
            entityId: Number.isInteger(eventId) ? eventId : null,
            ipAddress: getRequestIp(request),
            meta: failLog.meta,
          }, request.log)
          return reply.status(413).send({
            success: false,
            error: 'Файл слишком большой',
          })
        }
        app.log.error(error)
        return reply.status(500).send({
          success: false,
          error: err.message ?? 'Upload failed',
        })
      }
    },
  )

  app.get(
    '/attachments/:id/file',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const profile = resolveUserAccess(request)
      if (!profile) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' })
      }

      const id = Number((request.params as { id: string }).id)
      const attachment = findAttachmentById(id)
      if (!attachment?.storageKey) {
        return reply.status(404).send({ success: false, error: 'File not found' })
      }

      const event = findEventById(attachment.eventId)
      if (!event || !canViewEvent(profile, event)) {
        return reply.status(404).send({ success: false, error: 'File not found' })
      }

      const stream = openStoredFile(app.config.env, attachment.storageKey)
      if (!stream) {
        return reply.status(404).send({ success: false, error: 'File missing on disk' })
      }

      const disposition = (request.query as { download?: string }).download === '1'
        ? 'attachment'
        : 'inline'

      return reply
        .header('Content-Type', attachment.mimeType)
        .header(
          'Content-Disposition',
          `${disposition}; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
        )
        .send(stream)
    },
  )

  app.delete(
    '/attachments/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const profile = resolveUserAccess(request)
      if (!profile) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' })
      }

      const id = Number((request.params as { id: string }).id)
      const existing = findAttachmentById(id)
      if (existing) {
        const event = findEventById(existing.eventId)
        if (!event || !canViewEvent(profile, event)) {
          return reply.status(404).send({ success: false, error: 'Attachment not found' })
        }
        if (!canEditEvent(profile, event)) {
          return reply.status(403).send({ success: false, error: 'Forbidden' })
        }
      }

      const removed = await deleteAttachment(app.config.env, id)
      if (!removed) {
        return reply.status(404).send({ success: false, error: 'Attachment not found' })
      }

      const event = existing?.eventId
        ? findEventById(existing.eventId)
        : null
      const actor = jwtActor(request)
      const deleteLog = buildAttachmentDeleteMeta(
        existing?.name ?? String(id),
        event?.topic ?? null,
        existing?.eventId ?? null,
      )
      logActivity(app.config.env, {
        level: 'info',
        category: 'attachment',
        action: 'attachment.delete',
        message: deleteLog.message,
        userId: actor?.userId,
        userLogin: actor?.userLogin,
        userName: actor?.userName,
        entityType: 'event',
        entityId: existing?.eventId ?? null,
        ipAddress: getRequestIp(request),
        meta: deleteLog.meta,
      }, request.log)

      return { success: true }
    },
  )
}
