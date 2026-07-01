import { Type } from 'class-transformer'
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsNumber,
	IsObject,
	IsOptional,
	IsString,
	Min,
	MinLength,
	ValidateNested
} from 'class-validator'
import { ProductCondition, ProductType } from '@prisma/client'

export class ProductImageDto {
	@IsString()
	url: string

	@IsOptional()
	@IsString()
	alt?: string
}

export class ProductSeoDto {
	@IsOptional()
	@IsString()
	title?: string

	@IsOptional()
	@IsString()
	description?: string
}

export class CreateProductDto {
	@IsString()
	@MinLength(1, { message: 'Вкажіть назву' })
	name: string

	@IsString()
	@MinLength(1, { message: 'Вкажіть артикул' })
	sku: string

	// Якщо не передано — згенерується з name (транслітерація)
	@IsOptional()
	@IsString()
	slug?: string

	@IsString()
	categoryId: string

	@IsNumber({ maxDecimalPlaces: 2 }, { message: 'Невірна ціна' })
	@Min(0)
	price: number

	@IsOptional()
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	oldPrice?: number

	// Знижка активна (стара ціна показується закресленою)
	@IsOptional()
	@IsBoolean()
	onSale?: boolean

	@IsEnum(ProductType)
	type: ProductType

	@IsOptional()
	@IsEnum(ProductCondition)
	condition?: ProductCondition

	// inStock не приймаємо — вираховується зі stockQty
	@IsOptional()
	@IsInt()
	@Min(0)
	stockQty?: number

	// TipTap JSON (джерело правди); HTML генерується на бекенді (ADR-0006)
	@IsOptional()
	@IsObject()
	descriptionJson?: Record<string, unknown>

	// Довільні характеристики ключ–значення
	@IsOptional()
	@IsObject()
	attributes?: Record<string, string>

	@IsOptional()
	@IsObject()
	seo?: ProductSeoDto

	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ProductImageDto)
	images?: ProductImageDto[]

	// «Живі фото» — реальні знімки екземпляра (окремий блок на сторінці товару, isLive:true)
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ProductImageDto)
	livePhotos?: ProductImageDto[]

	// id сумісних авто (ProductFitment M2M)
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	carIds?: string[]

	@IsOptional()
	@IsBoolean()
	isActive?: boolean
}
