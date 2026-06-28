import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { AppModule } from 'src/app.module'

describe('Auth (e2e)', () => {
	let app: INestApplication
	const email = `e2e_${Date.now()}@tesla.test`
	const password = 'secret123'

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
		app = moduleRef.createNestApplication()
		app.setGlobalPrefix('api')
		app.use(cookieParser())
		app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
		await app.init()
	})

	afterAll(async () => {
		await app.close()
	})

	it('повний цикл: register → me → logout → 401 → login', async () => {
		const agent = request.agent(app.getHttpServer())

		const reg = await agent.post('/api/auth/register').send({ email, password })
		expect(reg.status).toBe(201)
		expect(reg.body.user.email).toBe(email)
		expect(reg.body.user.role).toBe('user')

		const me = await agent.get('/api/auth/me')
		expect(me.status).toBe(200)
		expect(me.body.email).toBe(email)

		await agent.post('/api/auth/logout').expect(201)
		await agent.get('/api/auth/me').expect(401)

		const login = await agent.post('/api/auth/login').send({ email, password })
		expect(login.status).toBe(201)
		expect(login.body.user.email).toBe(email)
	})

	it('register з зайнятим email → 409', async () => {
		await request(app.getHttpServer())
			.post('/api/auth/register')
			.send({ email, password })
			.expect(409)
	})

	it('login з невірним паролем → 401', async () => {
		await request(app.getHttpServer())
			.post('/api/auth/login')
			.send({ email, password: 'wrong-pass' })
			.expect(401)
	})

	it('валідація: невалідний email → 400', async () => {
		await request(app.getHttpServer())
			.post('/api/auth/register')
			.send({ email: 'not-an-email', password })
			.expect(400)
	})
})
