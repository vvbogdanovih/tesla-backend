import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString } from 'class-validator'
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard'
import { RolesGuard } from 'src/common/guards/roles.guard'
import { Roles } from 'src/common/decorators/roles.decorator'
import { S3Service } from './s3.service'

class PresignDto {
	@IsString()
	@IsIn(['image/jpeg', 'image/png', 'image/webp'])
	contentType: string

	@IsOptional()
	@IsString()
	prefix?: string
}

@ApiTags('s3')
@Controller('s3')
export class S3Controller {
	constructor(private readonly s3: S3Service) {}

	// Presigned URL для завантаження зображень — лише адмін
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('admin', 'superadmin')
	@Post('presign')
	presign(@Body() dto: PresignDto) {
		return this.s3.presignUpload(dto.contentType, dto.prefix)
	}
}
