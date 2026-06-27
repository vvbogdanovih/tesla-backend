import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-jwt'
import { ENV } from '../constants'
import { JWTPayload } from '../types/jwt-payload'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
	constructor() {
		super({
			jwtFromRequest: (req: { cookies?: Record<string, string> }) =>
				req?.cookies?.[ENV.ACCESS_TOKEN_NAME] ?? null,
			secretOrKey: ENV.JWT_SECRET
		})
	}

	async validate(payload: JWTPayload) {
		return payload
	}
}
