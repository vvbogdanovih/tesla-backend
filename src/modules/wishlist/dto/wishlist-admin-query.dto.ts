import { Type } from 'class-transformer'
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class WishlistAdminQueryDto {
	// фільтр за конкретним товаром — «хто хоче цей товар»
	@IsOptional()
	@IsString()
	productId?: string

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(200)
	limit?: number
}
