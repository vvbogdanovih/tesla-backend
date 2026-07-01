import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard'
import { CurrentUser } from 'src/common/decorators/current-user.decorator'
import type { JWTPayload } from 'src/common/types/jwt-payload'
import { WishlistService } from './wishlist.service'

// Обране — лише для авторизованих (ADR-0012). Гість тисне ♡ → фронт веде на логін.
@ApiTags('wishlist')
@UseGuards(JwtAuthGuard)
@Controller('account/wishlist')
export class WishlistController {
	constructor(private readonly wishlist: WishlistService) {}

	// Обране поточного користувача (картки товарів)
	@Get()
	list(@CurrentUser() user: JWTPayload) {
		return this.wishlist.list(BigInt(user.sub))
	}

	// Додати товар в обране (ідемпотентно)
	@Post(':productId')
	add(@CurrentUser() user: JWTPayload, @Param('productId') productId: string) {
		return this.wishlist.add(BigInt(user.sub), productId)
	}

	// Прибрати товар з обраного
	@Delete(':productId')
	remove(@CurrentUser() user: JWTPayload, @Param('productId') productId: string) {
		return this.wishlist.remove(BigInt(user.sub), productId)
	}
}
