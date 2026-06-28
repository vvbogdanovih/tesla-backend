import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as argon2 from 'argon2'
import { User } from '@prisma/client'
import { PrismaService } from 'src/database/prisma/prisma.service'
import { ENV } from 'src/common/constants'
import { JWTPayload } from 'src/common/types/jwt-payload'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'

@Injectable()
export class AuthService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly jwt: JwtService
	) {}

	private readonly argonOpts = { secret: Buffer.from(ENV.PASSWORD_PEPPER) }

	async register(dto: RegisterDto) {
		const exists = await this.prisma.user.findUnique({ where: { email: dto.email } })
		if (exists) throw new ConflictException('Користувач з таким email вже існує')

		const passwordHash = await argon2.hash(dto.password, this.argonOpts)
		const user = await this.prisma.user.create({
			data: {
				email: dto.email,
				passwordHash,
				firstName: dto.firstName,
				lastName: dto.lastName,
				phone: dto.phone
			}
		})
		return this.buildAuthResult(user)
	}

	async login(dto: LoginDto) {
		const user = await this.prisma.user.findUnique({ where: { email: dto.email } })
		if (!user?.passwordHash) throw new UnauthorizedException('Невірний email або пароль')

		const valid = await argon2.verify(user.passwordHash, dto.password, this.argonOpts)
		if (!valid) throw new UnauthorizedException('Невірний email або пароль')

		return this.buildAuthResult(user)
	}

	async refresh(refreshToken?: string) {
		if (!refreshToken) throw new UnauthorizedException('Відсутній токен оновлення')

		let payload: JWTPayload
		try {
			payload = await this.jwt.verifyAsync<JWTPayload>(refreshToken, {
				secret: ENV.REFRESH_JWT_SECRET
			})
		} catch {
			throw new UnauthorizedException('Недійсний токен оновлення')
		}

		const user = await this.prisma.user.findUnique({ where: { id: BigInt(payload.sub) } })
		if (!user) throw new UnauthorizedException('Користувача не знайдено')

		return this.buildAuthResult(user)
	}

	async me(payload: JWTPayload) {
		const user = await this.prisma.user.findUnique({ where: { id: BigInt(payload.sub) } })
		if (!user) throw new UnauthorizedException('Користувача не знайдено')
		return this.safeUser(user)
	}

	private buildAuthResult(user: User) {
		const payload: JWTPayload = {
			sub: user.id.toString(),
			role: user.role,
			email: user.email ?? undefined
		}
		return {
			accessToken: this.jwt.sign(payload, {
				secret: ENV.JWT_SECRET,
				expiresIn: ENV.JWT_EXPIRATION
			}),
			refreshToken: this.jwt.sign(payload, {
				secret: ENV.REFRESH_JWT_SECRET,
				expiresIn: ENV.REFRESH_JWT_EXPIRATION
			}),
			user: this.safeUser(user)
		}
	}

	private safeUser(user: User) {
		return {
			id: user.id,
			email: user.email,
			phone: user.phone,
			firstName: user.firstName,
			lastName: user.lastName,
			role: user.role
		}
	}
}
