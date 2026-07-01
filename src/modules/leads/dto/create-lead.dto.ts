import { Type } from 'class-transformer'
import { IsEmail, IsEnum, IsNumber, IsOptional, IsString, MinLength } from 'class-validator'
import { LeadType } from '@prisma/client'

export class CreateLeadDto {
	@IsEnum(LeadType)
	type: LeadType

	@IsString()
	@MinLength(2, { message: 'Вкажіть імʼя' })
	name: string

	@IsString()
	@MinLength(5, { message: 'Вкажіть телефон' })
	phone: string

	@IsOptional()
	@IsEmail({}, { message: 'Невірний email' })
	email?: string

	@IsOptional()
	@IsString()
	vin?: string

	@IsOptional()
	@IsString()
	link?: string

	// бажана ціна (для price_subscribe)
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	targetPrice?: number

	@IsOptional()
	@IsString()
	productId?: string

	@IsOptional()
	@IsString()
	message?: string
}
