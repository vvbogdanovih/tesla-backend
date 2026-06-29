import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from 'src/app.module'
import { PrismaService } from 'src/database/prisma/prisma.service'

describe('Catalog (e2e)', () => {
	let app: INestApplication
	let prisma: PrismaService
	const sfx = Date.now()
	const activeSlug = `fara-liva-${sfx}`
	const hiddenSlug = `kapot-${sfx}`
	let carSlug: string

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
		app = moduleRef.createNestApplication()
		app.setGlobalPrefix('api')
		app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
		await app.init()
		prisma = app.get(PrismaService)

		const category = await prisma.category.create({
			data: { slug: `kuzov-${sfx}`, name: 'Кузов (e2e)' }
		})
		const car = await prisma.car.create({
			data: { model: 'Model 3', slug: `m3-${sfx}`, productionStart: new Date('2017-07-01') }
		})
		carSlug = car.slug

		await prisma.product.create({
			data: {
				slug: activeSlug,
				sku: `FAR-${sfx}`,
				name: 'Фара ліва Model 3',
				price: 4500,
				type: 'original',
				stockQty: 3,
				categoryId: category.id,
				isActive: true,
				fitment: { create: [{ carId: car.id }] }
			}
		})
		await prisma.product.create({
			data: {
				slug: hiddenSlug,
				sku: `KPT-${sfx}`,
				name: 'Капот прихований',
				price: 8000,
				type: 'original',
				stockQty: 0,
				categoryId: category.id,
				isActive: false
			}
		})
	})

	afterAll(async () => {
		await app.close()
	})

	it('GET /catalog/products — лише активні, з пагінацією', async () => {
		const res = await request(app.getHttpServer()).get('/api/catalog/products').expect(200)
		const slugs = res.body.items.map((i: { slug: string }) => i.slug)
		expect(slugs).toContain(activeSlug)
		expect(slugs).not.toContain(hiddenSlug)
		expect(res.body).toHaveProperty('total')
		expect(res.body).toHaveProperty('pages')
	})

	it('GET /catalog/products?car= — фільтр сумісності', async () => {
		const res = await request(app.getHttpServer())
			.get('/api/catalog/products')
			.query({ car: carSlug })
			.expect(200)
		const slugs = res.body.items.map((i: { slug: string }) => i.slug)
		expect(slugs).toContain(activeSlug)
	})

	it('GET /catalog/products?inStock=true — лише в наявності', async () => {
		const res = await request(app.getHttpServer())
			.get('/api/catalog/products')
			.query({ inStock: 'true' })
			.expect(200)
		const slugs = res.body.items.map((i: { slug: string }) => i.slug)
		expect(slugs).toContain(activeSlug) // stockQty 3
	})

	it('GET /catalog/products/:slug — картка з сумісністю', async () => {
		const res = await request(app.getHttpServer())
			.get(`/api/catalog/products/${activeSlug}`)
			.expect(200)
		expect(res.body.name).toBe('Фара ліва Model 3')
		expect(res.body.cars[0].model).toBe('Model 3')
		expect(res.body).not.toHaveProperty('descriptionJson')
	})

	it('GET /catalog/products/:slug — неактивний → 404', async () => {
		await request(app.getHttpServer()).get(`/api/catalog/products/${hiddenSlug}`).expect(404)
	})

	it('GET /catalog/search — pg_trgm за назвою', async () => {
		const res = await request(app.getHttpServer())
			.get('/api/catalog/search')
			.query({ q: 'Фара' })
			.expect(200)
		const slugs = res.body.map((i: { slug: string }) => i.slug)
		expect(slugs).toContain(activeSlug)
	})
})
