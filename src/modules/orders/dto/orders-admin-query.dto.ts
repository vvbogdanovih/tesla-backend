import { Type } from 'class-transformer'
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { OrderStatus } from '@prisma/client'

export class OrdersAdminQueryDto {
	@IsOptional()
	@IsEnum(OrderStatus)
	status?: OrderStatus

	// пошук за підрядком номера замовлення (без регістру)
	@IsOptional()
	@IsString()
	q?: string

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit?: number
}
