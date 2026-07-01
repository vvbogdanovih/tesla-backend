import { Injectable, NotFoundException } from '@nestjs/common'
import { LeadStatus } from '@prisma/client'
import { PrismaService } from 'src/database/prisma/prisma.service'
import { CreateLeadDto } from './dto/create-lead.dto'

@Injectable()
export class LeadsService {
	constructor(private readonly prisma: PrismaService) {}

	async create(dto: CreateLeadDto) {
		// productId необовʼязковий; якщо невалідний/неіснуючий — лід усе одно зберігаємо
		let productId: bigint | null = null
		if (dto.productId) {
			try {
				const id = BigInt(dto.productId)
				const exists = await this.prisma.product.findUnique({ where: { id }, select: { id: true } })
				if (exists) productId = id
			} catch {
				productId = null
			}
		}

		const lead = await this.prisma.lead.create({
			data: {
				type: dto.type,
				name: dto.name.trim(),
				phone: dto.phone.trim(),
				email: dto.email?.trim() || null,
				vin: dto.vin?.trim() || null,
				link: dto.link?.trim() || null,
				targetPrice: dto.targetPrice ?? null,
				productId,
				message: dto.message?.trim() || null
			}
		})
		return { id: lead.id, ok: true }
	}

	findAll(status?: LeadStatus) {
		return this.prisma.lead.findMany({
			where: status ? { status } : {},
			orderBy: { createdAt: 'desc' },
			include: { product: { select: { id: true, name: true, slug: true } } }
		})
	}

	async setStatus(id: bigint, status: LeadStatus) {
		await this.ensureExists(id)
		return this.prisma.lead.update({ where: { id }, data: { status } })
	}

	async remove(id: bigint) {
		await this.ensureExists(id)
		await this.prisma.lead.delete({ where: { id } })
		return { ok: true }
	}

	private async ensureExists(id: bigint) {
		const lead = await this.prisma.lead.findUnique({ where: { id }, select: { id: true } })
		if (!lead) throw new NotFoundException('Заявку не знайдено')
	}
}
