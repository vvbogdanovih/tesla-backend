import { IsInt, IsObject, IsOptional, IsString, MinLength } from 'class-validator'

export class CategorySeoDto {
	title?: string
	description?: string
}

export class CreateCategoryDto {
	@IsString()
	@MinLength(1, { message: 'Вкажіть назву' })
	name: string

	// Якщо не передано — згенерується з name (транслітерація укр → латиниця)
	@IsOptional()
	@IsString()
	slug?: string

	@IsOptional()
	@IsInt()
	sortOrder?: number

	@IsOptional()
	@IsObject()
	seo?: CategorySeoDto
}
