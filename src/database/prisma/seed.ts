import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import 'dotenv/config'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
	// Довідник авто (покоління Tesla)
	const cars = [
		{ model: 'Model 3', generation: 'Pre-facelift', slug: 'model-3' },
		{ model: 'Model 3', generation: 'Highland', slug: 'model-3-highland' },
		{ model: 'Model Y', generation: 'Phase 1', slug: 'model-y' },
		{ model: 'Model Y', generation: 'Juniper', slug: 'model-y-juniper' },
		{ model: 'Model S', generation: null, slug: 'model-s' },
		{ model: 'Model X', generation: null, slug: 'model-x' }
	]
	for (const c of cars) {
		await prisma.car.upsert({ where: { slug: c.slug }, update: {}, create: c })
	}

	// Глобальні системи
	const systems = [
		'Кузов',
		'Підвіска',
		'Гальмівна система',
		'Електрика',
		'Акумулятор високої напруги',
		'Внутрішнє оздоблення',
		'Зовнішні ліхтарі',
		'Колеса'
	]
	for (let i = 0; i < systems.length; i++) {
		const name = systems[i]
		const slug = name
			.toLowerCase()
			.replace(/[^a-zа-яіїєґ0-9]+/gi, '-')
			.replace(/^-|-$/g, '')
		await prisma.system.upsert({
			where: { slug },
			update: {},
			create: { slug, name, sortOrder: i }
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
