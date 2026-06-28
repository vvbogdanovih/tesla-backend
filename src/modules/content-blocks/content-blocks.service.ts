import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from 'src/database/prisma/prisma.service'
import { richTextToHtml } from 'src/common/rich-text/rich-text.util'
import { UpdateContentBlockDto } from './dto/update-content-block.dto'

@Injectable()
export class ContentBlocksService {
	constructor(private readonly prisma: PrismaService) {}

	findAll() {
		return this.prisma.contentBlock.findMany({ orderBy: { id: 'asc' } })
	}

	async findByKey(key: string) {
		const block = await this.prisma.contentBlock.findUnique({ where: { key } })
		if (!block) throw new NotFoundException('Блок не знайдено')
		return block
	}

	// Фіксований набір — лише оновлення вмісту наявного блоку
	async update(key: string, dto: UpdateContentBlockDto) {
		await this.findByKey(key)
		return this.prisma.contentBlock.update({
			where: { key },
			data: {
				bodyJson: (dto.bodyJson ?? null) as Prisma.InputJsonValue,
				bodyHtml: richTextToHtml(dto.bodyJson) || null
			}
		})
	}
}
