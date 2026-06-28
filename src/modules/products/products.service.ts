import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from 'src/database/prisma/prisma.service'
import { slugify } from 'src/common/utils/slugify'
import { richTextToHtml } from 'src/common/rich-text/rich-text.util'
import { CreateProductDto, ProductImageDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'

@Injectable()
export class ProductsService {
	constructor(private readonly prisma: PrismaService) {}

	// Адмін-список (усі, вкл. неактивні)
	findAll() {
		return this.prisma.product.findMany({
			orderBy: { createdAt: 'desc' },
			include: {
				category: { select: { id: true, name: true } },
				images: { orderBy: { sortOrder: 'asc' }, take: 1 },
				_count: { select: { fitment: true } }
			}
		})
	}

	async findOne(id: bigint) {
		const product = await this.prisma.product.findUnique({
			where: { id },
			include: {
				category: { select: { id: true, name: true } },
				images: { orderBy: { sortOrder: 'asc' } },
				fitment: { include: { car: { select: { id: true, model: true, generation: true } } } }
			}
		})
		if (!product) throw new NotFoundException('Товар не знайдено')
		return product
	}

	async create(dto: CreateProductDto) {
		const categoryId = await this.resolveCategory(dto.categoryId)
		const carIds = await this.resolveCars(dto.carIds)
		await this.ensureSkuFree(dto.sku.trim())
		const slug = await this.uniqueSlug(dto.slug?.trim() || dto.name)

		try {
			return await this.prisma.product.create({
				data: {
					name: dto.name.trim(),
					sku: dto.sku.trim(),
					slug,
					categoryId,
					price: dto.price,
					oldPrice: dto.oldPrice ?? null,
					type: dto.type,
					condition: dto.condition ?? 'new',
					inStock: dto.inStock ?? true,
					stockQty: dto.stockQty ?? 0,
					descriptionJson: (dto.descriptionJson ?? null) as Prisma.InputJsonValue,
					descriptionHtml: richTextToHtml(dto.descriptionJson) || null,
					warranty: dto.warranty?.trim() || null,
					deliveryTerms: dto.deliveryTerms?.trim() || null,
					attributes: (dto.attributes ?? {}) as Prisma.InputJsonValue,
					seo: (dto.seo ?? {}) as Prisma.InputJsonValue,
					isActive: dto.isActive ?? true,
					images: { create: this.imageRows(dto.images) },
					fitment: { create: carIds.map(carId => ({ carId })) }
				},
				include: { images: true, fitment: true }
			})
		} catch (e) {
			throw this.mapError(e)
		}
	}

	async update(id: bigint, dto: UpdateProductDto) {
		await this.ensureExists(id)

		const data: Prisma.ProductUpdateInput = {}
		if (dto.name !== undefined) data.name = dto.name.trim()
		if (dto.sku !== undefined) {
			await this.ensureSkuFree(dto.sku.trim(), id)
			data.sku = dto.sku.trim()
		}
		if (dto.slug !== undefined) data.slug = await this.uniqueSlug(dto.slug, id)
		if (dto.price !== undefined) data.price = dto.price
		if (dto.oldPrice !== undefined) data.oldPrice = dto.oldPrice ?? null
		if (dto.type !== undefined) data.type = dto.type
		if (dto.condition !== undefined) data.condition = dto.condition
		if (dto.inStock !== undefined) data.inStock = dto.inStock
		if (dto.stockQty !== undefined) data.stockQty = dto.stockQty
		if (dto.warranty !== undefined) data.warranty = dto.warranty?.trim() || null
		if (dto.deliveryTerms !== undefined) data.deliveryTerms = dto.deliveryTerms?.trim() || null
		if (dto.attributes !== undefined) data.attributes = dto.attributes as Prisma.InputJsonValue
		if (dto.seo !== undefined) data.seo = dto.seo as Prisma.InputJsonValue
		if (dto.isActive !== undefined) data.isActive = dto.isActive

		if (dto.descriptionJson !== undefined) {
			data.descriptionJson = (dto.descriptionJson ?? null) as Prisma.InputJsonValue
			data.descriptionHtml = richTextToHtml(dto.descriptionJson) || null
		}
		if (dto.categoryId !== undefined) {
			const categoryId = await this.resolveCategory(dto.categoryId)
			data.category = { connect: { id: categoryId } }
		}
		// Галерея/сумісність — повна заміна (delete + recreate)
		if (dto.images !== undefined) {
			data.images = { deleteMany: {}, create: this.imageRows(dto.images) }
		}
		if (dto.carIds !== undefined) {
			const carIds = await this.resolveCars(dto.carIds)
			data.fitment = { deleteMany: {}, create: carIds.map(carId => ({ carId })) }
		}

		try {
			return await this.prisma.product.update({ where: { id }, data, include: { images: true } })
		} catch (e) {
			throw this.mapError(e)
		}
	}

	async remove(id: bigint) {
		await this.ensureExists(id)

		// Товар у замовленнях не видаляємо (історія) — пропонуємо деактивацію
		const inOrders = await this.prisma.orderItem.count({ where: { productId: id } })
		if (inOrders > 0) {
			throw new ConflictException(
				`Товар є в замовленнях (${inOrders}). Замість видалення — деактивуйте його.`
			)
		}

		await this.prisma.product.delete({ where: { id } })
		return { ok: true }
	}

	private async ensureSkuFree(sku: string, exceptId?: bigint) {
		const found = await this.prisma.product.findUnique({ where: { sku }, select: { id: true } })
		if (found && found.id !== exceptId) {
			throw new ConflictException('Товар із таким артикулом (SKU) вже існує')
		}
	}

	// Унікальний slug: базовий з name, при колізії — суфікс -2, -3… (назви товарів можуть повторюватись)
	private async uniqueSlug(base: string, exceptId?: bigint): Promise<string> {
		const root = slugify(base) || 'product'
		let candidate = root
		let n = 2
		// зазвичай 1 ітерація; цикл лише на випадок реальних колізій
		while (true) {
			const found = await this.prisma.product.findUnique({
				where: { slug: candidate },
				select: { id: true }
			})
			if (!found || found.id === exceptId) return candidate
			candidate = `${root}-${n++}`
		}
	}

	private imageRows(images?: ProductImageDto[]) {
		return (images ?? []).map((img, i) => ({
			url: img.url,
			alt: img.alt?.trim() || null,
			sortOrder: i
		}))
	}

	private async resolveCategory(categoryId: string): Promise<bigint> {
		let id: bigint
		try {
			id = BigInt(categoryId)
		} catch {
			throw new BadRequestException('Невірний categoryId')
		}
		const exists = await this.prisma.category.findUnique({ where: { id }, select: { id: true } })
		if (!exists) throw new NotFoundException('Категорію не знайдено')
		return id
	}

	private async resolveCars(carIds?: string[]): Promise<bigint[]> {
		if (!carIds?.length) return []
		let ids: bigint[]
		try {
			ids = carIds.map(c => BigInt(c))
		} catch {
			throw new BadRequestException('Невірний carId у сумісності')
		}
		const found = await this.prisma.car.count({ where: { id: { in: ids } } })
		if (found !== ids.length) throw new NotFoundException('Деяке авто зі сумісності не знайдено')
		return ids
	}

	private async ensureExists(id: bigint) {
		const p = await this.prisma.product.findUnique({ where: { id }, select: { id: true } })
		if (!p) throw new NotFoundException('Товар не знайдено')
	}

	private mapError(e: unknown) {
		if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
			const target = (e.meta?.target as string[])?.join(', ') ?? ''
			const field = target.includes('sku') ? 'артикулом (SKU)' : 'slug'
			return new ConflictException(`Товар із таким ${field} вже існує`)
		}
		return e
	}
}
