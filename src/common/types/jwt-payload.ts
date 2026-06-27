import { UserRole } from '@prisma/client'

export interface JWTPayload {
	sub: string // user id
	role: UserRole
	email?: string
}
