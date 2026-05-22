import type { Env } from '../config/env.js'
import type { CrmParticipant } from '../types/crm.js'

/** Демо-участники (id совпадают с условными id в corporate.users). */
const MOCK_PARTICIPANTS: CrmParticipant[] = [
  {
    id: 101,
    login: 'konstantinovkk',
    name: 'Константинов К.К.',
    email: 'konstantinovkk@admsr.ru',
    phone: '52-52-52 (вн. 9999)',
    line1: 'Константинов Константин',
    line2: 'Константинович',
    address: 'Энгельса 10, кб. 300',
  },
  {
    id: 102,
    login: 'ivanovaii',
    name: 'Иванова И.И.',
    email: 'ivanovaii@admsr.ru',
    phone: '52-52-53 (вн. 1201)',
    line1: 'Иванова Инна',
    line2: 'Игоревна',
    address: 'пр. Строителей 22, каб. 401',
  },
  {
    id: 103,
    login: 'marcenkovskiy_rf',
    name: 'Марценковский Р.Ф.',
    email: 'marcenkovskiy_rf@admsr.ru',
    phone: '52-52-56 (вн. 101)',
    ofo: 'ОФО-1',
    line1: 'Марценковский Роман',
    line2: 'Фёдорович',
    address: 'пл. Пионеров 2, каб. 701',
  },
  {
    id: 104,
    login: 'markovayv',
    name: 'Маркова Ю.В.',
    email: 'markovayv@admsr.ru',
    phone: '52-52-57 (вн. 4500)',
    line1: 'Маркова Юлия',
    line2: 'Владимировна',
    address: 'ул. Кирова 7, каб. 12',
  },
]

export class CrmParticipantsService {
  constructor(private readonly env: Env) {}

  async list(search?: string): Promise<CrmParticipant[]> {
    if (this.env.CRM_MOCK)
      return filterMock(MOCK_PARTICIPANTS, search)

    return this.fetchFromCrm({ search })
  }

  async getById(id: number): Promise<CrmParticipant | null> {
    const [participant] = await this.getByIds([id])
    return participant ?? null
  }

  async getByIds(ids: number[]): Promise<CrmParticipant[]> {
    const unique = [...new Set(ids.filter(id => Number.isInteger(id) && id > 0))]
    if (!unique.length)
      return []

    if (this.env.CRM_MOCK)
      return filterMockByIds(MOCK_PARTICIPANTS, unique)

    try {
      return await this.fetchFromCrm({ ids: unique })
    } catch {
      const all = await this.list()
      const set = new Set(unique)
      return all.filter(p => set.has(p.id))
    }
  }

  private async fetchFromCrm(options: {
    search?: string
    ids?: number[]
  }): Promise<CrmParticipant[]> {
    const url = new URL(this.env.CRM_PARTICIPANTS_PATH, this.env.CRM_BASE_URL)
    if (options.search?.trim())
      url.searchParams.set('q', options.search.trim())
    if (options.ids?.length)
      url.searchParams.set('ids', options.ids.join(','))

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.env.CRM_TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Host: this.env.CRM_HOST_HEADER,
          'X-Sync-Secret': this.env.CRM_SYNC_SECRET,
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`CRM participants HTTP ${response.status}`)
      }

      const data = (await response.json()) as {
        success?: boolean
        participants?: CrmParticipant[]
        users?: CrmParticipant[]
      }

      const list = data.participants ?? data.users ?? []
      return Array.isArray(list) ? list : []
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CRM fetch failed'
      throw new Error(message)
    } finally {
      clearTimeout(timeout)
    }
  }
}

function filterMockByIds(
  list: CrmParticipant[],
  ids: number[],
): CrmParticipant[] {
  const set = new Set(ids)
  return list.filter(p => set.has(p.id))
}

function filterMock(list: CrmParticipant[], search?: string): CrmParticipant[] {
  const q = search?.trim().toLowerCase()
  if (!q)
    return list
  return list.filter((p) => {
    const haystack = [p.name, p.login, p.email, p.phone, p.ofo, p.line1, p.line2]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}
