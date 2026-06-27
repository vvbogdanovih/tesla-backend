import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { JWTPayload } from '../types/jwt-payload'

export const CurrentUser = createParamDecorator(
	(_data: unknown, ctx: ExecutionContext): JWTPayload | undefined => {
		const request = ctx.switchToHttp().getRequest()
		return request.user
	}
)
