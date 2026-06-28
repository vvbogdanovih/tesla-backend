import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator'

export class CreateCarDto {
	@IsOptional()
	@IsString()
	brand?: string

	@IsString()
	@MinLength(1, { message: 'Вкажіть модель' })
	model: string

	@IsOptional()
	@IsString()
	generation?: string

	// Якщо не передано — згенерується з model + generation
	@IsOptional()
	@IsString()
	slug?: string

	// URL фото (завантажується в S3/R2 через /s3/presign)
	@IsOptional()
	@IsString()
	imageUrl?: string

	// Авто мусить мати дату початку випуску
	@IsDateString({}, { message: 'Вкажіть дату початку випуску' })
	productionStart: string

	@IsOptional()
	@IsDateString()
	productionEnd?: string
}
