import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from 'src/database/prisma/prisma.service'
import { WishlistAdminQueryDto } from './dto/wishlist-admin-query.dto'

// Поля картки товару у списку обраного — той самий контракт, що й у каталозі
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
	images: {
		where: { isLive: false },
		orderBy: { sortOrder: 'asc' as const },
		take: 1,
		select: { url: true, alt: true }
	},
	// прапорець наявності «живих фото» для плашки на картці (без завантаження самих фото)
	_count: { select: { images: { where: { isLive: true } } } }
} satisfies Prisma.ProductSelect

@Injectable()
export class WishlistService {
	constructor(private readonly prisma: PrismaService) {}

	// Обране поточного користувача — картки товарів (новіші зверху)
	async list(userId: bigint) {
		const rows = await this.prisma.wishlistItem.findMany({
			where: { userId },
			orderBy: { createdAt: 'desc' },
			select: { createdAt: true, product: { select: CARD_SELECT } }
		})
		return rows.map(({ createdAt, product }) => {
			const { _count, ...rest } = product as unknown as {
				_count?: { images: number }
				[k: string]: unknown
			}
			return { ...rest, hasLivePhotos: (_count?.images ?? 0) > 0, addedAt: createdAt }
		})
	}

	// Додати в обране — ідемпотентно (повторний виклик не дублює)
	async add(userId: bigint, productIdRaw: string) {
		const productId = this.parseId(productIdRaw)
		const product = await this.prisma.product.findUnique({
			where: { id: productId },
			select: { id: true }
		})
		if (!product) throw new NotFoundException('Товар не знайдено')
		await this.prisma.wishlistItem.upsert({
			where: { userId_productId: { userId, productId } },
			create: { userId, productId },
			update: {}
		})
		return { ok: true, inWishlist: true }
	}

	// Прибрати з обраного — ідемпотентно (не кидає помилку, якщо запису немає)
	async remove(userId: bigint, productIdRaw: string) {
		const productId = this.parseId(productIdRaw)
		await this.prisma.wishlistItem.deleteMany({ where: { userId, productId } })
		return { ok: true, inWishlist: false }
	}

	// Адмін: хто що додав в обране + популярність товарів (для обдзвону) — ADR-0012
	async adminList(q: WishlistAdminQueryDto) {
		const page = q.page ?? 1
		const limit = Math.min(q.limit ?? 50, 200)

		const where: Prisma.WishlistItemWhereInput = {}
		if (q.productId) where.productId = this.parseId(q.productId)

		const [items, total] = await this.prisma.$transaction([
			this.prisma.wishlistItem.findMany({
				where,
				orderBy: { createdAt: 'desc' },
				skip: (page - 1) * limit,
				take: limit,
				select: {
					createdAt: true,
					user: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							phone: true,
							email: true
						}
					},
					product: { select: { id: true, name: true, slug: true, sku: true } }
				}
			}),
			this.prisma.wishlistItem.count({ where })
		])

		// популярність (топ товарів за кількістю додавань) — окремо від транзакції для точних типів
		const popular = await this.prisma.wishlistItem.groupBy({
			by: ['productId'],
			_count: { productId: true },
			orderBy: { _count: { productId: 'desc' } },
			take: 10
		})

		// назви для «найбажаніших товарів» (топ за кількістю додавань)
		const topIds = popular.map(p => p.productId)
		const products = topIds.length
			? await this.prisma.product.findMany({
					where: { id: { in: topIds } },
					select: { id: true, name: true, slug: true, sku: true }
				})
			: []
		const byId = new Map(products.map(p => [p.id.toString(), p]))
		const topProducts = popular.map(p => ({
			product: byId.get(p.productId.toString()) ?? null,
			count: p._count.productId
		}))

		return {
			items,
			total,
			page,
			limit,
			pages: Math.max(1, Math.ceil(total / limit)),
			topProducts
		}
	}

	private parseId(raw: string): bigint {
		try {
			return BigInt(raw)
		} catch {
			throw new BadRequestException('Невірний productId')
		}
	}
}
