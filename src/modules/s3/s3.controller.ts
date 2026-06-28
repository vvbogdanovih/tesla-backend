import {
	Body,
	Controller,
	FileTypeValidator,
	MaxFileSizeValidator,
	ParseFilePipe,
	Post,
	UploadedFile,
	UseGuards,
	UseInterceptors
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString } from 'class-validator'
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard'
import { RolesGuard } from 'src/common/guards/roles.guard'
import { Roles } from 'src/common/decorators/roles.decorator'
import { S3Service } from './s3.service'

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024 // 10 MB

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

	// Завантаження зображення → конвертація в AVIF → R2. Лише адмін.
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('admin', 'superadmin')
	@Post('upload')
	@UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_SIZE } }))
	upload(
		@UploadedFile(
			new ParseFilePipe({
				validators: [
					new MaxFileSizeValidator({ maxSize: MAX_UPLOAD_SIZE }),
					new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp|avif|gif)$/ })
				]
			})
		)
		file: Express.Multer.File,
		@Body('prefix') prefix?: string
	) {
		return this.s3.uploadImage(file.buffer, prefix)
	}

	// Presigned URL (лишаємо як опцію для прямого завантаження без обробки) — лише адмін
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('admin', 'superadmin')
	@Post('presign')
	presign(@Body() dto: PresignDto) {
		return this.s3.presignUpload(dto.contentType, dto.prefix)
	}
}
