import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, Prisma } from '@prisma/client'
import 'dotenv/config'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CONTENT_BLOCKS } from '../../modules/content-blocks/content-blocks.constants'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const SEED_DATA = join(__dirname, '../../../prisma/seed-data')

// Реальні дані з teslalviv.com (scripts/scrape/*) лежать у prisma/seed-data/*.json.
// Фолбек на дефолти, якщо JSON ще не згенеровано.
function loadJson<T>(file: string, fallback: T): T {
	const path = join(SEED_DATA, file)
	return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback
}

interface CarSeed {
	model: string
	generation: string | null
	slug: string
	productionStart: string
}
interface CategorySeed {
	name: string
	slug: string
	sortOrder: number
}
interface ProductSeed {
	sku: string
	slug: string
	name: string
	price: number
	oldPrice: number | null
	onSale: boolean
	condition: 'new' | 'used' | 'clearance'
	type: 'original' | 'analog'
	stockQty: number
	categorySlug: string
	carSlugs: string[]
	attributes: Record<string, string>
	descriptionHtml: string | null
	descriptionJson: unknown | null
	images: { url: string; alt: string; sortOrder: number }[]
}

async function main() {
	// Довідник авто (покоління Tesla) — дата початку випуску обовʼязкова
	const cars = loadJson<CarSeed[]>('cars.json', [
		{ model: 'Model 3', generation: 'Pre-facelift', slug: 'model-3', productionStart: '2017-07-01' },
		{ model: 'Model 3', generation: 'Highland', slug: 'model-3-highland', productionStart: '2023-09-01' },
		{ model: 'Model Y', generation: 'Phase 1', slug: 'model-y', productionStart: '2020-03-01' },
		{ model: 'Model Y', generation: 'Juniper', slug: 'model-y-juniper', productionStart: '2025-01-01' },
		{ model: 'Model S', generation: null, slug: 'model-s', productionStart: '2012-06-01' },
		{ model: 'Model X', generation: null, slug: 'model-x', productionStart: '2015-09-01' }
	])
	for (const c of cars) {
		const productionStart = new Date(c.productionStart)
		await prisma.car.upsert({
			where: { slug: c.slug },
			update: { model: c.model, generation: c.generation, productionStart },
			create: { model: c.model, generation: c.generation, slug: c.slug, productionStart }
		})
	}

	// Глобальні категорії деталей (slug — латиниця через транслітерацію)
	const categories = loadJson<CategorySeed[]>('categories.json', [])
	for (const c of categories) {
		await prisma.category.upsert({
			where: { slug: c.slug },
			update: { name: c.name, sortOrder: c.sortOrder },
			create: { slug: c.slug, name: c.name, sortOrder: c.sortOrder }
		})
	}
	console.log(`  авто: ${cars.length}, категорії: ${categories.length}`)

	// Товари з teslalviv.com (scripts/scrape/scrape-products.ts → products.json).
	// Опційно: якщо JSON відсутній — пропускаємо (напр. чистий локальний сід).
	const products = loadJson<ProductSeed[]>('products.json', [])
	if (products.length) {
		const catId = new Map(
			(await prisma.category.findMany({ select: { id: true, slug: true } })).map(c => [c.slug, c.id])
		)
		const carId = new Map(
			(await prisma.car.findMany({ select: { id: true, slug: true } })).map(c => [c.slug, c.id])
		)
		let done = 0
		let skipped = 0
		for (const p of products) {
			const categoryId = catId.get(p.categorySlug)
			if (!categoryId) {
				skipped++
				continue
			}
			const data = {
				name: p.name,
				price: p.price,
				oldPrice: p.oldPrice ?? null,
				onSale: p.onSale,
				condition: p.condition,
				type: p.type,
				stockQty: p.stockQty,
				categoryId,
				attributes: p.attributes,
				descriptionHtml: p.descriptionHtml,
				...(p.descriptionJson != null
					? { descriptionJson: p.descriptionJson as Prisma.InputJsonValue }
					: {})
			}
			const product = await prisma.product.upsert({
				where: { sku: p.sku },
				update: data,
				create: { sku: p.sku, slug: p.slug, ...data }
			})
			// фото та сумісність — повна синхронізація (idempotent)
			await prisma.productImage.deleteMany({ where: { productId: product.id } })
			if (p.images.length) {
				await prisma.productImage.createMany({
					data: p.images.map(im => ({
						productId: product.id,
						url: im.url,
						alt: im.alt,
						sortOrder: im.sortOrder
					}))
				})
			}
			await prisma.productFitment.deleteMany({ where: { productId: product.id } })
			const carIds = p.carSlugs.map(s => carId.get(s)).filter((x): x is bigint => x != null)
			if (carIds.length) {
				await prisma.productFitment.createMany({
					data: carIds.map(cid => ({ productId: product.id, carId: cid }))
				})
			}
			done++
		}
		console.log(`  товари: ${done} (пропущено без категорії: ${skipped})`)
	}

	// Наскрізні тексти сайту (фіксований набір — створюємо, якщо немає)
	for (const block of CONTENT_BLOCKS) {
		await prisma.contentBlock.upsert({
			where: { key: block.key },
			update: { title: block.title },
			create: { key: block.key, title: block.title }
		})
	}

	console.log('✅ Seed виконано')
}

main()
	.catch(e => {
		console.error(e)
		process.exit(1)
	})
	.finally(() => prisma.$disconnect())
