import { ExecutionContext, Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

/**
 * Не блокує запит за відсутності/невалідності токена — просто лишає
 * request.user порожнім. Корисно для маршрутів «гість або користувач»
 * (кошик, перегляд із персоналізацією).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
	canActivate(context: ExecutionContext) {
		return super.canActivate(context)
	}

	handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser {
		return user as TUser
	}
}
