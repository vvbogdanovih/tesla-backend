/**
 * Скрейп товарів із teslalviv.com (WooCommerce Store API) → prisma/seed-data/products.json.
 *
 * Для кожного товару:
 *   - ціни: on_sale ? {price: sale, oldPrice: regular} : {price: regular, oldPrice: null}
 *   - stockQty: is_in_stock ? 10 : 0
 *   - condition/type: парсимо зі списку фактів в описі ("Стан:", "Тип запчастини:")
 *   - attributes (key-value): усі розпарсені факти (Стан, Модель авто, Тип запчастини, Код запчастини)
 *   - category + fitment(cars): через category-map.json (старий catId → {category, car})
 *   - description: чистий прозовий текст (без службового списку фактів); зазвичай порожній → null
 *   - images: ВСІ фото → завантаження → AVIF (q55, ресайз 1600) → R2; ключ products/<sku>/<i>.avif
 *
 * Перезапуск безпечний: фото з наявним ключем у R2 не перевантажуються (HeadObject).
 */
import { PutObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import 'dotenv/config'
import { slugify } from '../../src/common/utils/slugify'
import categoryMap from '../../prisma/seed-data/category-map.json'

const STORE = 'https://teslalviv.com/wp-json/wc/store/v1/products'
const OUT = join(__dirname, '../../prisma/seed-data')
const MAX_DIMENSION = 1600
const AVIF_QUALITY = 55
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable'
const IMG_CONCURRENCY = 6

const BUCKET = process.env.AWS_S3_BUCKET_NAME!
const PUBLIC_URL = process.env.AWS_S3_PUBLIC_URL!
const s3 = new S3Client({
	region: process.env.AWS_REGION,
	...(process.env.AWS_S3_ENDPOINT ? { endpoint: process.env.AWS_S3_ENDPOINT } : {}),
	forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true',
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
	},
	requestChecksumCalculation: 'WHEN_REQUIRED',
	responseChecksumValidation: 'WHEN_REQUIRED'
})

type CatMap = Record<string, { category: string | null; car: string | null }>
const catMap = categoryMap as CatMap

// Ручні override для товарів із прогалинами категорій на старому сайті (за SKU)
const OVERRIDES: Record<string, { categorySlug: string; carSlugs: string[] }> = {
	'1486943-00-A': { categorySlug: 'elektryka', carSlugs: ['model-3'] }, // клаксон, без категорій на сайті
	'1047020-00-E': { categorySlug: 'zovnishni-elementy', carSlugs: ['model-x'] } // гриль, привʼязаний лише до Model X
}

interface WcImage {
	src: string
}
interface WcCategory {
	id: number
}
interface WcProduct {
	id: number
	name: string
	sku: string
	on_sale: boolean
	is_in_stock: boolean
	prices: { price: string; regular_price: string; sale_price: string; currency_minor_unit: number }
	categories: WcCategory[]
	images: WcImage[]
	description: string
	short_description: string
}

interface SeedProduct {
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

const stripTags = (html: string) =>
	html
		.replace(/<[^>]+>/g, '\n')
		.replace(/&nbsp;| /g, ' ')
		.replace(/&amp;/g, '&')
		.split('\n')
		.map(s => s.trim())
		.filter(Boolean)

// Розпарсити "Ключ: значення" з опису у key-value
function parseSpecs(p: WcProduct): Record<string, string> {
	const lines = [...stripTags(p.short_description || ''), ...stripTags(p.description || '')]
	const specs: Record<string, string> = {}
	for (const line of lines) {
		const m = line.match(/^([^:]{2,40}):\s*(.+?);?\s*$/)
		if (m) {
			const key = m[1].trim()
			const val = m[2].trim()
			if (val && !(key in specs)) specs[key] = val
		}
	}
	return specs
}

function detectCondition(specs: Record<string, string>): 'new' | 'used' | 'clearance' {
	const v = (specs['Стан'] || '').toLowerCase()
	if (/б\/?[ву]|вживан|потерт/.test(v)) return 'used'
	if (/уцін|клиренс|clearance/.test(v)) return 'clearance'
	return 'new'
}

function detectType(specs: Record<string, string>): 'original' | 'analog' {
	const v = (specs['Тип запчастини'] || specs['Тип'] || '').toLowerCase()
	if (/оригінал|original|oem/.test(v)) return 'original'
	return 'analog'
}

// category + cars з усіх категорій товару
function resolveCatAndCars(p: WcProduct): { categorySlug: string | null; carSlugs: string[] } {
	const cats: string[] = []
	const cars = new Set<string>()
	for (const c of p.categories) {
		const m = catMap[String(c.id)]
		if (!m) continue
		if (m.category) cats.push(m.category)
		if (m.car) cars.add(m.car)
	}
	// найчастіша категорія (зазвичай усі зводяться в одну канонічну)
	const freq = new Map<string, number>()
	cats.forEach(c => freq.set(c, (freq.get(c) ?? 0) + 1))
	const categorySlug = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
	return { categorySlug, carSlugs: [...cars] }
}

const num = (s: string) => {
	const n = Number(s)
	return Number.isFinite(n) ? n : 0
}

const seenSlugs = new Set<string>()
function uniqueSlug(name: string, sku: string): string {
	let base = slugify(name) || slugify(sku) || 'tovar'
	if (seenSlugs.has(base)) base = `${base}-${slugify(sku)}`
	let slug = base
	let i = 2
	while (seenSlugs.has(slug)) slug = `${base}-${i++}`
	seenSlugs.add(slug)
	return slug
}

async function fetchAllProducts(): Promise<WcProduct[]> {
	const all: WcProduct[] = []
	for (let page = 1; page <= 60; page++) {
		const res = await fetch(`${STORE}?per_page=100&page=${page}`)
		if (!res.ok) break
		const batch = (await res.json()) as WcProduct[]
		all.push(...batch)
		process.stdout.write(`\rОтримано товарів: ${all.length}`)
		if (batch.length < 100) break
	}
	process.stdout.write('\n')
	return all
}

async function objectExists(key: string): Promise<boolean> {
	try {
		await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
		return true
	} catch {
		return false
	}
}

async function rehostImage(src: string, key: string): Promise<string | null> {
	const url = `${PUBLIC_URL}/${key}`
	if (await objectExists(key)) return url
	try {
		const res = await fetch(src)
		if (!res.ok) {
			console.warn(`\n  ⚠ фото ${res.status}: ${src}`)
			return null
		}
		const input = Buffer.from(await res.arrayBuffer())
		const processed = await sharp(input, { failOn: 'none' })
			.rotate()
			.resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
			.avif({ quality: AVIF_QUALITY, effort: 4 })
			.toBuffer()
		await s3.send(
			new PutObjectCommand({
				Bucket: BUCKET,
				Key: key,
				Body: processed,
				ContentType: 'image/avif',
				CacheControl: IMMUTABLE_CACHE
			})
		)
		return url
	} catch (e) {
		console.warn(`\n  ⚠ помилка фото ${src}: ${(e as Error).message}`)
		return null
	}
}

// проста чергова конкурентність
async function pool<T, R>(items: T[], limit: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
	const out: R[] = new Array(items.length)
	let idx = 0
	const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (idx < items.length) {
			const i = idx++
			out[i] = await fn(items[i], i)
		}
	})
	await Promise.all(workers)
	return out
}

async function main() {
	let products = await fetchAllProducts()
	const limit = Number(process.env.LIMIT)
	if (Number.isFinite(limit) && limit > 0) {
		products = products.slice(0, limit)
		console.log(`(LIMIT=${limit} — тест на підмножині)`)
	}
	const skuKey = (sku: string) => slugify(sku) || 'noskus'

	const seed: SeedProduct[] = []
	let noCat = 0
	let imgTotal = 0

	for (let pi = 0; pi < products.length; pi++) {
		const p = products[pi]
		const specs = parseSpecs(p)
		const override = OVERRIDES[p.sku]
		const resolved = resolveCatAndCars(p)
		const categorySlug = override?.categorySlug ?? resolved.categorySlug
		const carSlugs = override?.carSlugs ?? resolved.carSlugs
		if (!categorySlug) {
			noCat++
			console.warn(`\n  ⚠ без категорії: [${p.sku}] ${p.name}`)
			continue
		}

		const onSale = !!p.on_sale
		const regular = num(p.prices.regular_price)
		const sale = num(p.prices.sale_price)
		const price = onSale && sale ? sale : regular || num(p.prices.price)
		const oldPrice = onSale && regular && sale && regular > sale ? regular : null

		const folder = skuKey(p.sku || String(p.id))
		const imgs = await pool(p.images, IMG_CONCURRENCY, async (im, i) => {
			const ext = 'avif'
			const key = `products/${folder}/${i}.${ext}`
			const url = await rehostImage(im.src, key)
			return url ? { url, alt: p.name, sortOrder: i } : null
		})
		const images = imgs.filter((x): x is NonNullable<typeof x> => !!x)
		imgTotal += images.length

		seed.push({
			sku: p.sku || `TL-${p.id}`,
			slug: uniqueSlug(p.name, p.sku || String(p.id)),
			name: p.name,
			price,
			oldPrice,
			onSale,
			condition: detectCondition(specs),
			type: detectType(specs),
			stockQty: p.is_in_stock ? 10 : 0,
			categorySlug,
			carSlugs,
			attributes: specs,
			descriptionHtml: null,
			descriptionJson: null,
			images
		})

		process.stdout.write(
			`\rОброблено: ${pi + 1}/${products.length} | товарів у сіді: ${seed.length} | фото: ${imgTotal}`
		)

		// контрольна точка кожні 25 товарів (на випадок збою)
		if ((pi + 1) % 25 === 0) {
			mkdirSync(OUT, { recursive: true })
			writeFileSync(join(OUT, 'products.json'), JSON.stringify(seed, null, 2))
		}
	}
	process.stdout.write('\n')

	mkdirSync(OUT, { recursive: true })
	writeFileSync(join(OUT, 'products.json'), JSON.stringify(seed, null, 2))

	console.log(`\n✅ Готово`)
	console.log(`  товарів збережено: ${seed.length}`)
	console.log(`  без категорії (пропущено): ${noCat}`)
	console.log(`  зображень перехостовано: ${imgTotal}`)
	const byType = seed.reduce<Record<string, number>>((a, p) => ((a[p.type] = (a[p.type] || 0) + 1), a), {})
	const byCond = seed.reduce<Record<string, number>>((a, p) => ((a[p.condition] = (a[p.condition] || 0) + 1), a), {})
	console.log(`  тип:`, byType, `стан:`, byCond)
}

main().catch(e => {
	console.error(e)
	process.exit(1)
})
