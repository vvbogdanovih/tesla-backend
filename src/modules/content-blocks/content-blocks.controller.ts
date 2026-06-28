import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard'
import { RolesGuard } from 'src/common/guards/roles.guard'
import { Roles } from 'src/common/decorators/roles.decorator'
import { ContentBlocksService } from './content-blocks.service'
import { UpdateContentBlockDto } from './dto/update-content-block.dto'

@ApiTags('content-blocks')
@Controller('content-blocks')
export class ContentBlocksController {
	constructor(private readonly blocks: ContentBlocksService) {}

	// Публічно — сторфронт читає тексти за ключем
	@Get()
	findAll() {
		return this.blocks.findAll()
	}

	@Get(':key')
	findByKey(@Param('key') key: string) {
		return this.blocks.findByKey(key)
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('admin', 'superadmin')
	@Patch(':key')
	update(@Param('key') key: string, @Body() dto: UpdateContentBlockDto) {
		return this.blocks.update(key, dto)
	}
}
