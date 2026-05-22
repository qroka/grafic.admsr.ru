export type UserRole = 'admin' | 'manager' | 'moderator' | 'user'

export interface AuthUserPayload {
  sub: string
  userId: number
  login: string
  name: string
  email?: string
  role: UserRole
}

export interface LoginBody {
  login: string
  password: string
}

export interface LocalUser {
  id: number
  login: string
  name: string
  email: string | null
  role: UserRole
  externalUserId: number | null
  substituteSlug: string | null
}

export interface UserAccessProfile extends LocalUser {
  editableSubstituteSlugs: string[]
}

export interface PublicUserProfile {
  id: number
  login: string
  name: string
  email: string | null
  role: UserRole
  externalUserId: number | null
  substituteSlug: string | null
  editableSubstituteSlugs: string[]
}
