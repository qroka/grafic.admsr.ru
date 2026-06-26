import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { UserAccessProfile } from '../types/auth.js'
import {
  canViewEvent,
  shouldRedactHiddenAttachments,
  shouldRedactHiddenEvent,
} from './event-permissions.js'

function profile(overrides: Partial<UserAccessProfile> = {}): UserAccessProfile {
  return {
    id: 2,
    login: 'user',
    name: 'User',
    email: null,
    role: 'user',
    externalUserId: 100,
    substituteSlug: null,
    editableSubstituteSlugs: [],
    ...overrides,
  }
}

const hiddenEvent = {
  hidden: true,
  attachmentsHidden: false,
  substituteSlug: 'markova',
  participantIds: [200],
  creatorExternalId: 300,
}

const hiddenAttachmentsEvent = {
  hidden: false,
  attachmentsHidden: true,
  substituteSlug: 'markova',
  participantIds: [200],
  creatorExternalId: 300,
}

describe('hidden event permissions', () => {
  it('canViewEvent stays true for hidden events in schedule', () => {
    assert.equal(canViewEvent(profile(), hiddenEvent), true)
  })

  it('shouldRedactHiddenEvent hides details from unrelated user', () => {
    assert.equal(shouldRedactHiddenEvent(profile(), hiddenEvent), true)
  })

  it('participant sees hidden event details', () => {
    const participant = profile({ externalUserId: 200 })
    assert.equal(shouldRedactHiddenEvent(participant, hiddenEvent), false)
  })

  it('admin sees hidden event details', () => {
    const admin = profile({ role: 'admin', externalUserId: 1 })
    assert.equal(shouldRedactHiddenEvent(admin, hiddenEvent), false)
  })

  it('manager with slug access sees hidden event details', () => {
    const manager = profile({
      role: 'manager',
      substituteSlug: 'markova',
      editableSubstituteSlugs: ['markova'],
    })
    assert.equal(shouldRedactHiddenEvent(manager, hiddenEvent), false)
  })
})

describe('hidden attachments permissions', () => {
  it('shouldRedactHiddenAttachments hides files from unrelated user', () => {
    assert.equal(shouldRedactHiddenAttachments(profile(), hiddenAttachmentsEvent), true)
  })

  it('participant sees hidden attachments', () => {
    const participant = profile({ externalUserId: 200 })
    assert.equal(shouldRedactHiddenAttachments(participant, hiddenAttachmentsEvent), false)
  })

  it('event details stay visible when only attachments are hidden', () => {
    const viewer = profile()
    assert.equal(shouldRedactHiddenEvent(viewer, hiddenAttachmentsEvent), false)
    assert.equal(shouldRedactHiddenAttachments(viewer, hiddenAttachmentsEvent), true)
  })
})

describe('attachment IDOR regression', () => {
  it('unrelated user must be redacted before serving attachment', () => {
    const viewer = profile()
    assert.equal(canViewEvent(viewer, hiddenEvent), true)
    assert.equal(shouldRedactHiddenEvent(viewer, hiddenEvent), true)
  })
})
