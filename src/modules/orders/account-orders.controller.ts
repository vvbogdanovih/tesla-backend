import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard'
import { CurrentUser } from 'src/common/decorators/current-user.decorator'
import type { JWTPayload } from 'src/common/types/jwt-payload'
import { OrdersService } from './orders.service'

// Історія замовлень поточного користувача (кабінет)
@ApiTags('account')
@UseGuards(JwtAuthGuard)
@Controller('account/orders')
export class AccountOrdersController {
	constructor(private readonly orders: OrdersService) {}

	// Останні 50 замовлень користувача, новіші першими
	@Get()
	list(@CurrentUser() user: JWTPayload) {
		return this.orders.listForUser(BigInt(user.sub))
	}
}
