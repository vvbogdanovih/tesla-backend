import { ConflictException, UnauthorizedException } from '@nestjs/common'
import * as argon2 from 'argon2'
import { AuthService } from './auth.service'

jest.mock('argon2')

const mockedArgon = argon2 as jest.Mocked<typeof argon2>

const makeUser = (over: Partial<Record<string, unknown>> = {}) => ({
	id: BigInt(2),
	email: 'qa@tesla.test',
	phone: null,
	passwordHash: 'stored-hash',
	firstName: 'Олександр',
	lastName: null,
	role: 'user',
	createdAt: new Date(),
	...over
})

describe('AuthService', () => {
	let service: AuthService
	let prisma: { user: { findUnique: jest.Mock; create: jest.Mock } }
	let jwt: { sign: jest.Mock; verifyAsync: jest.Mock }

	beforeEach(() => {
		prisma = { user: { findUnique: jest.fn(), create: jest.fn() } }
		jwt = { sign: jest.fn(() => 'signed-token'), verifyAsync: jest.fn() }
		service = new AuthService(prisma as never, jwt as never)
		mockedArgon.hash.mockResolvedValue('new-hash')
		mockedArgon.verify.mockResolvedValue(true)
	})

	describe('register', () => {
		it('створює користувача й повертає токени + user', async () => {
			prisma.user.findUnique.mockResolvedValue(null)
			prisma.user.create.mockResolvedValue(makeUser({ passwordHash: 'new-hash' }))

			const res = await service.register({ email: 'qa@tesla.test', password: 'secret123' })

			expect(mockedArgon.hash).toHaveBeenCalledWith('secret123', expect.anything())
			expect(prisma.user.create).toHaveBeenCalled()
			expect(res.accessToken).toBe('signed-token')
			expect(res.refreshToken).toBe('signed-token')
			expect(res.user.email).toBe('qa@tesla.test')
			expect(res.user.role).toBe('user')
		})

		it('кидає ConflictException, якщо email зайнятий', async () => {
			prisma.user.findUnique.mockResolvedValue(makeUser())

			await expect(
				service.register({ email: 'qa@tesla.test', password: 'secret123' })
			).rejects.toBeInstanceOf(ConflictException)
			expect(prisma.user.create).not.toHaveBeenCalled()
		})
	})

	describe('login', () => {
		it('повертає токени при вірному паролі', async () => {
			prisma.user.findUnique.mockResolvedValue(makeUser())
			mockedArgon.verify.mockResolvedValue(true)

			const res = await service.login({ email: 'qa@tesla.test', password: 'secret123' })

			expect(res.user.id).toBe(BigInt(2))
			expect(res.accessToken).toBe('signed-token')
		})

		it('кидає Unauthorized при невірному паролі', async () => {
			prisma.user.findUnique.mockResolvedValue(makeUser())
			mockedArgon.verify.mockResolvedValue(false)

			await expect(
				service.login({ email: 'qa@tesla.test', password: 'wrong' })
			).rejects.toBeInstanceOf(UnauthorizedException)
		})

		it('кидає Unauthorized, якщо користувача немає', async () => {
			prisma.user.findUnique.mockResolvedValue(null)

			await expect(
				service.login({ email: 'no@tesla.test', password: 'secret123' })
			).rejects.toBeInstanceOf(UnauthorizedException)
		})
	})

	describe('refresh', () => {
		it('видає нові токени для валідного refresh', async () => {
			jwt.verifyAsync.mockResolvedValue({ sub: '2', role: 'user' })
			prisma.user.findUnique.mockResolvedValue(makeUser())

			const res = await service.refresh('valid-refresh')

			expect(jwt.verifyAsync).toHaveBeenCalled()
			expect(res.accessToken).toBe('signed-token')
		})

		it('кидає Unauthorized, якщо токен відсутній', async () => {
			await expect(service.refresh(undefined)).rejects.toBeInstanceOf(UnauthorizedException)
		})

		it('кидає Unauthorized для невалідного refresh', async () => {
			jwt.verifyAsync.mockRejectedValue(new Error('bad token'))

			await expect(service.refresh('bad')).rejects.toBeInstanceOf(UnauthorizedException)
		})
	})

	describe('me', () => {
		it('повертає безпечного користувача', async () => {
			prisma.user.findUnique.mockResolvedValue(makeUser())

			const res = await service.me({ sub: '2', role: 'user' })

			expect(res).toEqual({
				id: BigInt(2),
				email: 'qa@tesla.test',
				phone: null,
				firstName: 'Олександр',
				lastName: null,
				role: 'user'
			})
		})

		it('кидає Unauthorized, якщо користувача немає', async () => {
			prisma.user.findUnique.mockResolvedValue(null)

			await expect(service.me({ sub: '999', role: 'user' })).rejects.toBeInstanceOf(
				UnauthorizedException
			)
		})
	})
})
