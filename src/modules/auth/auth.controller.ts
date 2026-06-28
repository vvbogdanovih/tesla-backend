import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { ENV } from 'src/common/constants'
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard'
import { CurrentUser } from 'src/common/decorators/current-user.decorator'
import type { JWTPayload } from 'src/common/types/jwt-payload'
import { AuthService } from './auth.service'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
	constructor(private readonly auth: AuthService) {}

	@Post('register')
	async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
		const { accessToken, refreshToken, user } = await this.auth.register(dto)
		this.setCookies(res, accessToken, refreshToken)
		return { user }
	}

	@Post('login')
	async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
		const { accessToken, refreshToken, user } = await this.auth.login(dto)
		this.setCookies(res, accessToken, refreshToken)
		return { user }
	}

	@Post('refresh')
	async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		const token = req.cookies?.[ENV.REFRESH_TOKEN_NAME]
		const { accessToken, refreshToken, user } = await this.auth.refresh(token)
		this.setCookies(res, accessToken, refreshToken)
		return { user }
	}

	@Post('logout')
	logout(@Res({ passthrough: true }) res: Response) {
		res.clearCookie(ENV.ACCESS_TOKEN_NAME, this.cookieBase())
		res.clearCookie(ENV.REFRESH_TOKEN_NAME, this.cookieBase())
		return { ok: true }
	}

	@UseGuards(JwtAuthGuard)
	@Get('me')
	me(@CurrentUser() user: JWTPayload) {
		return this.auth.me(user)
	}

	private cookieBase() {
		return {
			httpOnly: true,
			secure: ENV.NODE_ENV === 'production',
			sameSite: 'lax' as const,
			path: '/'
		}
	}

	private setCookies(res: Response, access: string, refresh: string) {
		res.cookie(ENV.ACCESS_TOKEN_NAME, access, {
			...this.cookieBase(),
			maxAge: ENV.JWT_EXPIRATION * 1000
		})
		res.cookie(ENV.REFRESH_TOKEN_NAME, refresh, {
			...this.cookieBase(),
			maxAge: ENV.REFRESH_JWT_EXPIRATION * 1000
		})
	}
}
