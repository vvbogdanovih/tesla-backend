import { Type } from 'class-transformer'
import {
	ArrayMinSize,
	IsArray,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	Max,
	Min,
	MinLength,
	ValidateNested
} from 'class-validator'
import { DeliveryMethod, PaymentMethod } from '@prisma/client'

export class OrderItemDto {
	@IsString()
	productId: string

	@IsInt()
	@Min(1)
	@Max(999, { message: 'Завелика кількість в одній позиції' })
	qty: number
}

export class OrderCustomerDto {
	@IsString()
	@MinLength(2, { message: 'Вкажіть імʼя' })
	name: string

	@IsString()
	@MinLength(5, { message: 'Вкажіть телефон' })
	phone: string

	@IsOptional()
	@IsString()
	email?: string
}

export class OrderDeliveryDto {
	@IsEnum(DeliveryMethod)
	method: DeliveryMethod

	@IsOptional()
	@IsString()
	city?: string

	@IsOptional()
	@IsString()
	warehouse?: string
}

export class CreateOrderDto {
	@IsArray()
	@ArrayMinSize(1, { message: 'Кошик порожній' })
	@ValidateNested({ each: true })
	@Type(() => OrderItemDto)
	items: OrderItemDto[]

	@ValidateNested()
	@Type(() => OrderCustomerDto)
	customer: OrderCustomerDto

	@ValidateNested()
	@Type(() => OrderDeliveryDto)
	delivery: OrderDeliveryDto

	@IsEnum(PaymentMethod)
	paymentMethod: PaymentMethod

	@IsOptional()
	@IsString()
	comment?: string
}
