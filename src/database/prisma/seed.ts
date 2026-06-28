import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import 'dotenv/config'
import { slugify } from '../../common/utils/slugify'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
	// Довідник авто (покоління Tesla) — дата початку випуску обовʼязкова
	const cars = [
		{ model: 'Model 3', generation: 'Pre-facelift', slug: 'model-3', productionStart: '2017-07-01' },
		{ model: 'Model 3', generation: 'Highland', slug: 'model-3-highland', productionStart: '2023-09-01' },
		{ model: 'Model Y', generation: 'Phase 1', slug: 'model-y', productionStart: '2020-03-01' },
		{ model: 'Model Y', generation: 'Juniper', slug: 'model-y-juniper', productionStart: '2025-01-01' },
		{ model: 'Model S', generation: null, slug: 'model-s', productionStart: '2012-06-01' },
		{ model: 'Model X', generation: null, slug: 'model-x', productionStart: '2015-09-01' }
	]
	for (const c of cars) {
		const data = { ...c, productionStart: new Date(c.productionStart) }
		await prisma.car.upsert({
			where: { slug: c.slug },
			update: { productionStart: data.productionStart },
			create: data
		})
	}

	// Глобальні категорії деталей (slug — латиниця через транслітерацію)
	const categories = [
		'Кузов',
		'Підвіска',
		'Гальмівна система',
		'Електрика',
		'Акумулятор високої напруги',
		'Внутрішнє оздоблення',
		'Зовнішні ліхтарі',
		'Колеса'
	]
	for (let i = 0; i < categories.length; i++) {
		const name = categories[i]
		const slug = slugify(name)
		// upsert по name (backfill латинського slug на наявні рядки з кириличними slug)
		const existing = await prisma.category.findFirst({ where: { name } })
		if (existing) {
			await prisma.category.update({ where: { id: existing.id }, data: { slug, sortOrder: i } })
		} else {
			await prisma.category.create({ data: { slug, name, sortOrder: i } })
		}
	}

	console.log('✅ Seed виконано')
}

main()
	.catch(e => {
		console.error(e)
		process.exit(1)
	})
	.finally(() => prisma.$disconnect())
