/**
 * Скрейп категорій із teslalviv.com (WooCommerce Store API).
 *
 * Старе дерево неоднорідне:
 *   Model 3 / Y / Highland / Juniper:  Модель → Система → Підсистема → товар
 *   Model S / X:                       Модель → Варіант(рестайлінг) → Система → Підсистема → товар
 * До того ж назви систем розходяться між моделями
 *   ("Електрика" ≈ "Електрика (проводка, блоки керування…)",
 *    "Інфотейнмент" ≈ "Інфо-розважальна система", тощо).
 *
 * Ми зводимо до: тільки МОДЕЛЬ + КАТЕГОРІЯ.
 *   - Модель (L0) → наше авто (cars), для fitment.
 *   - Вузли-варіанти ("Model s first…") ПРОПУСКАЄМО.
 *   - Система → пласка глобальна Category; назву нормалізуємо до канону (дужки + аліаси).
 *   - Будь-яка підсистема/товар відноситься до своєї системи-категорії.
 *
 * Артефакти у prisma/seed-data/:
 *   cars.json          — наші авто (6 поколінь)
 *   categories.json    — пласкі глобальні категорії (канон, дедуп)
 *   category-map.json  — { [oldCatId]: { category: slug|null, car: carSlug|null } } для кроку товарів
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { slugify } from '../../src/common/utils/slugify'

const API = 'https://teslalviv.com/wp-json/wc/store/v1/products/categories'
const OUT = join(__dirname, '../../prisma/seed-data')

// Старий slug моделі → наш slug авто
const CAR_MAP: Record<string, string> = {
	'model-3': 'model-3',
	'model-3-jan-2024': 'model-3-highland',
	'model-s': 'model-s',
	'model-x': 'model-x',
	'model-y': 'model-y',
	'model-y-feb-2025': 'model-y-juniper'
}

// Наші авто (джерело правди для ресторингу)
const CARS = [
	{ model: 'Model 3', generation: 'Pre-facelift', slug: 'model-3', productionStart: '2017-07-01' },
	{ model: 'Model 3', generation: 'Highland', slug: 'model-3-highland', productionStart: '2023-09-01' },
	{ model: 'Model Y', generation: 'Phase 1', slug: 'model-y', productionStart: '2020-03-01' },
	{ model: 'Model Y', generation: 'Juniper', slug: 'model-y-juniper', productionStart: '2025-01-01' },
	{ model: 'Model S', generation: null, slug: 'model-s', productionStart: '2012-06-01' },
	{ model: 'Model X', generation: null, slug: 'model-x', productionStart: '2015-09-01' }
]

// Нормалізація розбіжних назв систем до канонічних (після зрізання дужок)
const ALIASES: Record<string, string> = {
	'Безпека та системи утримання': 'Безпека та обмеження',
	'Елементи закриття': 'Закриваючі компоненти',
	'Закриваючі елементи': 'Закриваючі компоненти',
	'Інфотейнмент': 'Інфо-розважальна система'
}

const normalize = (name: string): string => {
	const base = name.split('(')[0].trim()
	return ALIASES[base] ?? base
}

interface WcCat {
	id: number
	name: string
	slug: string
	parent: number
	count: number
}

async function fetchAll(): Promise<WcCat[]> {
	const all: WcCat[] = []
	for (let page = 1; page <= 50; page++) {
		const res = await fetch(`${API}?per_page=100&page=${page}`)
		if (!res.ok) break
		const batch = (await res.json()) as WcCat[]
		all.push(...batch)
		if (batch.length < 100) break
	}
	return all
}

async function main() {
	const cats = await fetchAll()
	const byId = new Map(cats.map(c => [c.id, c]))
	console.log(`Отримано категорій: ${cats.length}`)

	const L0ids = new Set(cats.filter(c => c.parent === 0).map(c => c.id))
	const isVariant = (n: WcCat) => L0ids.has(n.parent) && /^model/i.test(n.name)

	const buildChain = (cat: WcCat): WcCat[] => {
		const chain: WcCat[] = []
		const seen = new Set<number>()
		let cur: WcCat | undefined = cat
		while (cur && !seen.has(cur.id)) {
			chain.push(cur)
			seen.add(cur.id)
			if (cur.parent === 0) break
			cur = byId.get(cur.parent)
		}
		return chain
	}

	// Знайти (модель, систему) для будь-якої категорії, пропускаючи вузли-варіанти
	const resolve = (cat: WcCat): { model: WcCat | null; system: WcCat | null } => {
		const chain = buildChain(cat)
		const model = chain.find(n => n.parent === 0) ?? null
		if (!model) return { model: null, system: null }
		const variantIds = new Set(
			cats.filter(c => c.parent === model.id && /^model/i.test(c.name)).map(c => c.id)
		)
		// Система = вузол, чий батько — модель (і сам не варіант) АБО чий батько — варіант
		const system =
			chain.find(
				n =>
					n.id !== model.id &&
					!isVariant(n) &&
					(n.parent === model.id || variantIds.has(n.parent))
			) ?? null
		return { model, system }
	}

	const categoriesByName = new Map<
		string,
		{ name: string; slug: string; sortOrder: number; count: number; rawNames: Set<string> }
	>()
	const categoryMap: Record<string, { category: string | null; car: string | null }> = {}

	for (const cat of cats) {
		const { model, system } = resolve(cat)
		const carSlug = model ? (CAR_MAP[model.slug] ?? null) : null
		let categorySlug: string | null = null

		if (system) {
			const canon = normalize(system.name)
			categorySlug = slugify(canon)
			let entry = categoriesByName.get(canon)
			if (!entry) {
				entry = {
					name: canon,
					slug: categorySlug,
					sortOrder: categoriesByName.size,
					count: 0,
					rawNames: new Set()
				}
				categoriesByName.set(canon, entry)
			}
			entry.rawNames.add(system.name)
			// рахуємо товари лише на вузлі-системі (щоб не двоїти підсистеми)
			if (system.id === cat.id) entry.count += cat.count
		}

		categoryMap[cat.id] = { category: categorySlug, car: carSlug }
	}

	const categories = [...categoriesByName.values()]
		.sort((a, b) => b.count - a.count)
		.map((c, i) => ({ name: c.name, slug: c.slug, sortOrder: i }))

	mkdirSync(OUT, { recursive: true })
	writeFileSync(join(OUT, 'cars.json'), JSON.stringify(CARS, null, 2))
	writeFileSync(join(OUT, 'categories.json'), JSON.stringify(categories, null, 2))
	writeFileSync(join(OUT, 'category-map.json'), JSON.stringify(categoryMap, null, 2))

	console.log(`\nАвто: ${CARS.length}`)
	console.log(`Категорії (канон, дедуп): ${categories.length}\n`)
	for (const c of [...categoriesByName.values()].sort((a, b) => b.count - a.count)) {
		const aliases = [...c.rawNames].filter(n => n !== c.name)
		const tail = aliases.length ? `  [← ${aliases.join('; ')}]` : ''
		console.log(`  ~${String(c.count).padStart(3)} товарів | ${c.name} → ${c.slug}${tail}`)
	}
	console.log(`\nМапа категорій: ${Object.keys(categoryMap).length} записів`)
	console.log(`✅ Записано у ${OUT}`)
}

main().catch(e => {
	console.error(e)
	process.exit(1)
})
