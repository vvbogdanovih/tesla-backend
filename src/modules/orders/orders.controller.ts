import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { OrderStatus } from '@prisma/client'
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard'
import { OptionalJwtAuthGuard } from 'src/common/guards/optional-jwt-auth.guard'
import { RolesGuard } from 'src/common/guards/roles.guard'
import { Roles } from 'src/common/decorators/roles.decorator'
import { CurrentUser } from 'src/common/decorators/current-user.decorator'
import type { JWTPayload } from 'src/common/types/jwt-payload'
import { OrdersService } from './orders.service'
import { CreateOrderDto } from './dto/create-order.dto'
import { UpdateOrderStatusDto } from './dto/update-order-status.dto'

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
	constructor(private readonly orders: OrdersService) {}

	// Гостьовий чекаут; якщо є валідний токен — привʼязуємо до користувача
	@UseGuards(OptionalJwtAuthGuard)
	@Post()
	create(@Body() dto: CreateOrderDto, @CurrentUser() user?: JWTPayload) {
		const userId = user?.sub ? BigInt(user.sub) : undefined
		return this.orders.create(dto, userId)
	}

	// Адмін — список усіх замовлень
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('admin', 'superadmin')
	@Get()
	findAll(@Query('status') status?: OrderStatus) {
		return this.orders.findAll(status)
	}

	// Публічно — за номером (підтвердження/статус)
	@Get(':number')
	byNumber(@Param('number') orderNumber: string) {
		return this.orders.findByNumber(orderNumber)
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('admin', 'superadmin')
	@Patch(':id/status')
	setStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
		return this.orders.setStatus(BigInt(id), dto.status)
	}
}
