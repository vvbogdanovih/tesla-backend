import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator'

export class CreatePaymentRequisiteDto {
	// ПІБ отримувача — рівно 3 слова (Прізвище Імʼя По батькові)
	@IsString()
	@Matches(/^\s*\S+\s+\S+\s+\S+\s*$/, { message: 'Вкажіть ПІБ повністю' })
	label: string

	@IsOptional()
	@IsString()
	taxId?: string

	@IsOptional()
	@IsString()
	iban?: string

	@IsOptional()
	@IsString()
	bankName?: string

	@IsOptional()
	@IsString()
	liqpayPublicKey?: string

	// Секрет: шифрується перед збереженням; у відповідях не повертається
	@IsOptional()
	@IsString()
	liqpayPrivateKey?: string

	// Токен monobank-еквайрингу — секрет (шифрується, не повертається)
	@IsOptional()
	@IsString()
	monopayToken?: string

	@IsOptional()
	@IsBoolean()
	ibanActive?: boolean

	@IsOptional()
	@IsBoolean()
	liqpayActive?: boolean

	@IsOptional()
	@IsBoolean()
	monopayActive?: boolean
}
