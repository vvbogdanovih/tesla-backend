import { Type } from 'class-transformer'
import { IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator'
import { ProductCondition, ProductType } from '@prisma/client'

export class CatalogQueryDto {
	// текстовий пошук (назва / артикул)
	@IsOptional()
	@IsString()
	q?: string

	// slug(и) авто через кому (фільтр сумісності)
	@IsOptional()
	@IsString()
	car?: string

	// slug категорії
	@IsOptional()
	@IsString()
	category?: string

	@IsOptional()
	@IsEnum(ProductType)
	type?: ProductType

	@IsOptional()
	@IsEnum(ProductCondition)
	condition?: ProductCondition

	// 'true' → лише в наявності (stockQty > 0)
	@IsOptional()
	@IsString()
	inStock?: string

	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	minPrice?: number

	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	maxPrice?: number

	@IsOptional()
	@IsIn(['default', 'price_asc', 'price_desc', 'newest'])
	sort?: string

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	limit?: number
}
