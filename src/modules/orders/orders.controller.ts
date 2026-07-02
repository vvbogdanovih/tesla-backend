import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard'
import { OptionalJwtAuthGuard } from 'src/common/guards/optional-jwt-auth.guard'
import { RolesGuard } from 'src/common/guards/roles.guard'
import { Roles } from 'src/common/decorators/roles.decorator'
import { CurrentUser } from 'src/common/decorators/current-user.decorator'
import type { JWTPayload } from 'src/common/types/jwt-payload'
import { OrdersService } from './orders.service'
import { CreateOrderDto } from './dto/create-order.dto'
import { UpdateOrderStatusDto } from './dto/update-order-status.dto'
import { OrdersAdminQueryDto } from './dto/orders-admin-query.dto'

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

	// Адмін — список замовлень (пошук за номером, пагінація, фільтр статусу)
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('admin', 'superadmin')
	@Get()
	findAll(@Query() q: OrdersAdminQueryDto) {
		return this.orders.findAll(q)
	}

	// Адмін — повна деталь замовлення (шлях /id/:id, щоб не конфліктувати з публічним /:number)
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('admin', 'superadmin')
	@Get('id/:id')
	byId(@Param('id') id: string) {
		return this.orders.findById(id)
	}

	// Публічно — за номером (підтвердження/статус); лише безпечні поля, без PII
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
