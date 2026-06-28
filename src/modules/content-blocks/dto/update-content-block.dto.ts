import { IsObject, IsOptional } from 'class-validator'

export class UpdateContentBlockDto {
	// TipTap JSON; HTML генерується на бекенді (ADR-0006)
	@IsOptional()
	@IsObject()
	bodyJson?: Record<string, unknown>
}
