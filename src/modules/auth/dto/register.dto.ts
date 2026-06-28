import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator'

export class RegisterDto {
	@IsEmail()
	email: string

	@IsString()
	@MinLength(6, { message: 'Пароль має містити щонайменше 6 символів' })
	password: string

	@IsOptional()
	@IsString()
	firstName?: string

	@IsOptional()
	@IsString()
	lastName?: string

	@IsOptional()
	@IsString()
	phone?: string
}
