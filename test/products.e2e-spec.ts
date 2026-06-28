import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import * as argon2 from 'argon2'
import { AppModule } from 'src/app.module'
import { PrismaService } from 'src/database/prisma/prisma.service'

describe('Products (e2e)', () => {
	let app: INestApplication
	let prisma: PrismaService
	let agent: ReturnType<typeof request.agent>

	const email = `prod_e2e_${Date.now()}@tesla.test`
	const password = 'secret123'
	const sku = `E2E-${Date.now()}`
	let categoryId: string
	let carId: string
	let productId: string
	let slug: string

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
		app = moduleRef.createNestApplication()
		app.setGlobalPrefix('api')
		app.use(cookieParser())
		app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
		await app.init()

		prisma = app.get(PrismaService)

		// admin-користувач (хеш — як в auth.service: argon2 + pepper)
		const passwordHash = await argon2.hash(password, {
			secret: Buffer.from(process.env.PASSWORD_PEPPER as string)
		})
		await prisma.user.create({ data: { email, passwordHash, role: 'superadmin' } })

		// довідники
		const category = await prisma.category.create({
			data: { slug: `kuzov-${Date.now()}`, name: 'Кузов (e2e)' }
		})
		const car = await prisma.car.create({
			data: { model: 'Model 3', slug: `m3-${Date.now()}`, productionStart: new Date('2017-07-01') }
		})
		categoryId = category.id.toString()
		carId = car.id.toString()

		agent = request.agent(app.getHttpServer())
		await agent.post('/api/auth/login').send({ email, password }).expect(201)
	})

	afterAll(async () => {
		await app.close()
	})

	it('POST /products — створює товар (slug, html, fitment)', async () => {
		const res = await agent.post('/api/products').send({
			name: 'Фара ліва Model 3',
			sku,
			categoryId,
			price: 4500.5,
			oldPrice: 5200,
			onSale: true,
			type: 'original',
			stockQty: 3,
			carIds: [carId],
			descriptionJson: {
				type: 'doc',
				content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Опис' }] }]
			}
		})

		expect(res.status).toBe(201)
		expect(res.body.slug).toBe('fara-liva-model-3')
		expect(res.body.descriptionHtml).toContain('<p>')
		expect(res.body.fitment).toHaveLength(1)
		productId = res.body.id
		slug = res.body.slug
	})

	it('POST /products — дубль SKU → 409', async () => {
		await agent
			.post('/api/products')
			.send({ name: 'Інша', sku, categoryId, price: 100, type: 'analog' })
			.expect(409)
	})

	it('POST /products — неіснуюча категорія → 404', async () => {
		await agent
			.post('/api/products')
			.send({ name: 'X', sku: `${sku}-x`, categoryId: '99999999', price: 100, type: 'analog' })
			.expect(404)
	})

	it('POST /products — без авторизації → 401', async () => {
		await request(app.getHttpServer())
			.post('/api/products')
			.send({ name: 'Hack', sku: `${sku}-h`, categoryId, price: 1, type: 'analog' })
			.expect(401)
	})

	it('GET /products/:id — повертає сумісність із даними авто', async () => {
		const res = await agent.get(`/api/products/${productId}`).expect(200)
		expect(res.body.fitment[0].car.model).toBe('Model 3')
		expect(res.body.category.name).toBe('Кузов (e2e)')
	})

	it('PATCH /products/:id — оновлює ціну та замінює сумісність', async () => {
		const res = await agent
			.patch(`/api/products/${productId}`)
			.send({ price: 4200, carIds: [] })
			.expect(200)
		expect(Number(res.body.price)).toBe(4200)

		const reloaded = await agent.get(`/api/products/${productId}`).expect(200)
		expect(reloaded.body.fitment).toHaveLength(0)
	})

	it('PATCH /products/:id — зміна назви не міняє slug (SEO-стабільність)', async () => {
		await agent
			.patch(`/api/products/${productId}`)
			.send({ name: 'Перейменована фара' })
			.expect(200)

		const res = await agent.get(`/api/products/${productId}`).expect(200)
		expect(res.body.slug).toBe(slug)
		expect(res.body.name).toBe('Перейменована фара')
	})

	it('PATCH /products/:id — повна заміна галереї', async () => {
		await agent
			.patch(`/api/products/${productId}`)
			.send({ images: [{ url: 'https://x.r2.dev/p/1.avif', alt: 'нове' }] })
			.expect(200)

		const res = await agent.get(`/api/products/${productId}`).expect(200)
		expect(res.body.images).toHaveLength(1)
		expect(res.body.images[0].url).toContain('1.avif')
	})

	it('PATCH /products/:id — зміна SKU на зайнятий іншим товаром → 409', async () => {
		const other = await agent
			.post('/api/products')
			.send({ name: 'Інший товар', sku: `${sku}-OTHER`, categoryId, price: 50, type: 'analog' })
			.expect(201)

		await agent.patch(`/api/products/${productId}`).send({ sku: `${sku}-OTHER` }).expect(409)

		await agent.delete(`/api/products/${other.body.id}`).expect(200)
	})

	it('DELETE /products/:id — видаляє товар', async () => {
		await agent.delete(`/api/products/${productId}`).expect(200)
		await agent.get(`/api/products/${productId}`).expect(404)
	})
})
