import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from 'src/database/prisma/prisma.service'
import { slugify } from 'src/common/utils/slugify'
import { CreateCategoryDto } from './dto/create-category.dto'
import { UpdateCategoryDto } from './dto/update-category.dto'

@Injectable()
export class CategoriesService {
	constructor(private readonly prisma: PrismaService) {}

	// Плоский глобальний список (ADR-0002). Авто — окремий вимір (фільтр), не категорія.
	findAll() {
		return this.prisma.category.findMany({
			orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
			include: { _count: { select: { products: true } } }
		})
	}

	async create(dto: CreateCategoryDto) {
		try {
			return await this.prisma.category.create({
				data: {
					name: dto.name.trim(),
					slug: dto.slug?.trim() ? slugify(dto.slug) : slugify(dto.name),
					sortOrder: dto.sortOrder ?? 0,
					seo: (dto.seo ?? {}) as Prisma.InputJsonValue
				}
			})
		} catch (e) {
			throw this.mapError(e)
		}
	}

	async update(id: bigint, dto: UpdateCategoryDto) {
		await this.ensureExists(id)

		const data: Prisma.CategoryUpdateInput = {}
		if (dto.name !== undefined) data.name = dto.name.trim()
		if (dto.slug !== undefined) data.slug = slugify(dto.slug)
		if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder
		if (dto.seo !== undefined) data.seo = dto.seo as Prisma.InputJsonValue

		try {
			return await this.prisma.category.update({ where: { id }, data })
		} catch (e) {
			throw this.mapError(e)
		}
	}

	async remove(id: bigint) {
		await this.ensureExists(id)

		const products = await this.prisma.product.count({ where: { categoryId: id } })
		if (products > 0) {
			throw new ConflictException(
				`Неможливо видалити: до категорії прив'язано товарів — ${products}`
			)
		}

		await this.prisma.category.delete({ where: { id } })
		return { ok: true }
	}

	private async ensureExists(id: bigint) {
		const cat = await this.prisma.category.findUnique({ where: { id } })
		if (!cat) throw new NotFoundException('Категорію не знайдено')
	}

	private mapError(e: unknown) {
		if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
			return new ConflictException('Категорія з таким slug вже існує')
		}
		return e
	}
}
