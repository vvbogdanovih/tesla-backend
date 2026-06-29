import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from 'src/database/prisma/prisma.service'
import { CatalogQueryDto } from './dto/catalog-query.dto'

const DEFAULT_LIMIT = 24
const MAX_LIMIT = 60

// Поля картки товару у списку
const CARD_SELECT = {
	id: true,
	slug: true,
	sku: true,
	name: true,
	price: true,
	oldPrice: true,
	onSale: true,
	type: true,
	condition: true,
	stockQty: true,
	category: { select: { name: true, slug: true } },
	images: { orderBy: { sortOrder: 'asc' as const }, take: 1, select: { url: true, alt: true } }
} satisfies Prisma.ProductSelect

@Injectable()
export class CatalogService {
	constructor(private readonly prisma: PrismaService) {}

	async list(q: CatalogQueryDto) {
		const page = q.page ?? 1
		const limit = Math.min(q.limit ?? DEFAULT_LIMIT, MAX_LIMIT)

		const where: Prisma.ProductWhereInput = { isActive: true }
		if (q.category) where.category = { slug: q.category }
		if (q.car) {
			const slugs = q.car
				.split(',')
				.map(s => s.trim())
				.filter(Boolean)
			if (slugs.length) where.fitment = { some: { car: { slug: { in: slugs } } } }
		}
		if (q.type) where.type = q.type
		if (q.condition) where.condition = q.condition
		if (q.inStock === 'true') where.stockQty = { gt: 0 }
		if (q.minPrice !== undefined || q.maxPrice !== undefined) {
			where.price = {}
			if (q.minPrice !== undefined) where.price.gte = q.minPrice
			if (q.maxPrice !== undefined) where.price.lte = q.maxPrice
		}

		const orderBy: Prisma.ProductOrderByWithRelationInput =
			q.sort === 'price_asc'
				? { price: 'asc' }
				: q.sort === 'price_desc'
					? { price: 'desc' }
					: { createdAt: 'desc' } // newest / default

		const [items, total] = await this.prisma.$transaction([
			this.prisma.product.findMany({
				where,
				orderBy,
				skip: (page - 1) * limit,
				take: limit,
				select: CARD_SELECT
			}),
			this.prisma.product.count({ where })
		])

		return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) }
	}

	async bySlug(slug: string) {
		const p = await this.prisma.product.findFirst({
			where: { slug, isActive: true },
			include: {
				category: { select: { name: true, slug: true } },
				images: { orderBy: { sortOrder: 'asc' } },
				fitment: { include: { car: { select: { id: true, model: true, generation: true, slug: true } } } }
			}
		})
		if (!p) throw new NotFoundException('Товар не знайдено')

		// Публічна форма: без descriptionJson; сумісність — пласким списком авто
		return {
			id: p.id,
			slug: p.slug,
			sku: p.sku,
			name: p.name,
			price: p.price,
			oldPrice: p.oldPrice,
			onSale: p.onSale,
			type: p.type,
			condition: p.condition,
			stockQty: p.stockQty,
			attributes: p.attributes,
			descriptionHtml: p.descriptionHtml,
			seo: p.seo,
			category: p.category,
			images: p.images.map(i => ({ url: i.url, alt: i.alt })),
			cars: p.fitment.map(f => f.car)
		}
	}

	async search(q: string, limit = 8) {
		const term = q.trim()
		if (!term) return []
		const take = Math.min(limit, 20)
		const like = `%${term}%`

		// pg_trgm: підрядок (ILIKE) + нечіткий пошук короткого запиту в назві (word_similarity)
		const rows = await this.prisma.$queryRaw<{ id: bigint }[]>`
			SELECT id FROM products
			WHERE is_active = true
			  AND (
			    name ILIKE ${like} OR sku ILIKE ${like}
			    OR word_similarity(${term}, name) > 0.3
			    OR word_similarity(${term}, sku) > 0.3
			  )
			ORDER BY GREATEST(word_similarity(${term}, name), word_similarity(${term}, sku)) DESC, name ASC
			LIMIT ${take}
		`
		const ids = rows.map(r => BigInt(r.id))
		if (!ids.length) return []

		const products = await this.prisma.product.findMany({
			where: { id: { in: ids } },
			select: {
				id: true,
				slug: true,
				sku: true,
				name: true,
				price: true,
				images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } }
			}
		})
		const byId = new Map(products.map(p => [p.id.toString(), p]))
		return ids.map(id => byId.get(id.toString())).filter(Boolean)
	}
}
