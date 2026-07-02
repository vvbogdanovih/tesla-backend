import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { OrdersService } from './orders.service'
import { CreateOrderDto, OrderItemDto } from './dto/create-order.dto'

type PrismaMock = {
	product: {
		findMany: jest.Mock
		updateMany: jest.Mock
	}
	order: {
		findMany: jest.Mock
		findUnique: jest.Mock
		create: jest.Mock
		update: jest.Mock
		count: jest.Mock
	}
	$transaction: jest.Mock
}

const dbProduct = (over: Record<string, unknown> = {}) => ({
	id: BigInt(1),
	name: 'Фара ліва',
	sku: 'SKU-1',
	price: new Prisma.Decimal('1500.25'),
	stockQty: 5,
	...over
})

const baseDto = (over: Partial<CreateOrderDto> = {}): CreateOrderDto => ({
	items: [{ productId: '1', qty: 2 }],
	customer: { name: 'Іван', phone: '+380501112233' },
	delivery: { method: 'np', city: 'Львів', warehouse: '12' },
	paymentMethod: 'card',
	...over
})

const orderRecord = (over: Record<string, unknown> = {}) => ({
	id: BigInt(10),
	orderNumber: 'TL-2026-000001',
	userId: null,
	customer: { name: 'Іван', phone: '+380501112233', email: null },
	delivery: { method: 'np', city: 'Львів', warehouse: '12' },
	payment: { method: 'card', status: 'pending' },
	total: new Prisma.Decimal('3000.50'),
	status: 'new' as const,
	isOneClick: false,
	comment: null,
	createdAt: new Date('2026-07-01T10:00:00.000Z'),
	items: [
		{
			id: BigInt(100),
			orderId: BigInt(10),
			productId: BigInt(1),
			name: 'Фара ліва',
			sku: 'SKU-1',
			price: new Prisma.Decimal('1500.25'),
			qty: 2
		}
	],
	...over
})

describe('OrdersService', () => {
	let service: OrdersService
	let prisma: PrismaMock

	beforeEach(() => {
		prisma = {
			product: {
				findMany: jest.fn(),
				updateMany: jest.fn()
			},
			order: {
				findMany: jest.fn(),
				findUnique: jest.fn(),
				create: jest.fn(),
				update: jest.fn(),
				count: jest.fn()
			},
			// інтерактивна форма — колбек із tx=prisma; масивна форма — Promise.all
			$transaction: jest.fn((arg: unknown) =>
				Array.isArray(arg)
					? Promise.all(arg)
					: (arg as (tx: PrismaMock) => Promise<unknown>)(prisma)
			)
		}
		service = new OrdersService(prisma as never)
	})

	describe('create', () => {
		beforeEach(() => {
			prisma.product.findMany.mockResolvedValue([dbProduct()])
			prisma.product.updateMany.mockResolvedValue({ count: 1 })
			prisma.order.count.mockResolvedValue(0)
			prisma.order.create.mockResolvedValue(orderRecord())
		})

		it('бере ціни з БД (знімок), а не від клієнта; сума — Decimal', async () => {
			await service.create(baseDto())

			const [[createArgs]] = prisma.order.create.mock.calls as [
				[{ data: { total: Prisma.Decimal; items: { create: unknown[] } } }]
			]
			const { data } = createArgs
			expect(data.items.create).toEqual([
				{
					productId: BigInt(1),
					name: 'Фара ліва',
					sku: 'SKU-1',
					price: new Prisma.Decimal('1500.25'),
					qty: 2
				}
			])
			// 1500.25 × 2 = 3000.5 — рахуємо через Decimal, без float
			expect(data.total).toBeInstanceOf(Prisma.Decimal)
			expect(data.total.toString()).toBe('3000.5')
		})

		it('атомарно списує залишок (updateMany з gte + decrement)', async () => {
			await service.create(baseDto())

			expect(prisma.product.updateMany).toHaveBeenCalledWith({
				where: { id: BigInt(1), stockQty: { gte: 2 } },
				data: { stockQty: { decrement: 2 } }
			})
		})

		it('кидає Conflict при нестачі залишку і не створює замовлення', async () => {
			prisma.product.findMany.mockResolvedValue([dbProduct({ stockQty: 1 })])
			prisma.product.updateMany.mockResolvedValue({ count: 0 })

			await expect(service.create(baseDto())).rejects.toBeInstanceOf(ConflictException)
			expect(prisma.order.create).not.toHaveBeenCalled()
		})

		it('кидає BadRequest, якщо товару немає або він неактивний', async () => {
			prisma.product.findMany.mockResolvedValue([])

			await expect(service.create(baseDto())).rejects.toBeInstanceOf(BadRequestException)
			expect(prisma.product.updateMany).not.toHaveBeenCalled()
		})

		it('забороняє готівку не при самовивозі', async () => {
			await expect(service.create(baseDto({ paymentMethod: 'cash' }))).rejects.toBeInstanceOf(
				BadRequestException
			)
			expect(prisma.$transaction).not.toHaveBeenCalled()
		})

		it('дозволяє готівку при самовивозі', async () => {
			await expect(
				service.create(baseDto({ paymentMethod: 'cash', delivery: { method: 'pickup' } }))
			).resolves.toBeDefined()
		})

		it('повертає повну форму з id/total як рядками', async () => {
			const res = await service.create(baseDto())

			expect(res.id).toBe('10')
			expect(res.total).toBe('3000.5')
			expect(res.createdAt).toBe('2026-07-01T10:00:00.000Z')
			expect(res.items[0]).toEqual({
				id: '100',
				productId: '1',
				name: 'Фара ліва',
				sku: 'SKU-1',
				price: '1500.25',
				qty: 2
			})
		})
	})

	describe('OrderItemDto (валідація qty)', () => {
		it('відхиляє qty понад 999 (@Max)', async () => {
			const item = plainToInstance(OrderItemDto, { productId: '1', qty: 1000 })
			const errors = await validate(item)
			expect(errors.some(e => e.constraints?.max)).toBe(true)
		})

		it('відхиляє qty < 1 (@Min)', async () => {
			const item = plainToInstance(OrderItemDto, { productId: '1', qty: 0 })
			const errors = await validate(item)
			expect(errors.some(e => e.constraints?.min)).toBe(true)
		})

		it('пропускає валідний qty', async () => {
			const item = plainToInstance(OrderItemDto, { productId: '1', qty: 3 })
			await expect(validate(item)).resolves.toEqual([])
		})
	})

	describe('setStatus', () => {
		it('скасування повертає залишки лише для позицій із товаром', async () => {
			const order = orderRecord({
				items: [
					...orderRecord().items,
					// товар видалено (productId → null) — залишок не чіпаємо
					{
						id: BigInt(101),
						orderId: BigInt(10),
						productId: null,
						name: 'Знятий товар',
						sku: 'SKU-X',
						price: new Prisma.Decimal('10.00'),
						qty: 1
					}
				]
			})
			prisma.order.findUnique.mockResolvedValue(order)
			prisma.product.updateMany.mockResolvedValue({ count: 1 })
			prisma.order.update.mockResolvedValue(orderRecord({ status: 'canceled' }))

			await service.setStatus(BigInt(10), 'canceled')

			expect(prisma.product.updateMany).toHaveBeenCalledTimes(1)
			expect(prisma.product.updateMany).toHaveBeenCalledWith({
				where: { id: BigInt(1) },
				data: { stockQty: { increment: 2 } }
			})
			expect(prisma.order.update).toHaveBeenCalledWith({
				where: { id: BigInt(10) },
				data: { status: 'canceled' },
				include: { items: true }
			})
		})

		it('відновлення зі скасованого повторно списує залишок (gte-перевірка)', async () => {
			prisma.order.findUnique.mockResolvedValue(orderRecord({ status: 'canceled' }))
			prisma.product.updateMany.mockResolvedValue({ count: 1 })
			prisma.order.update.mockResolvedValue(orderRecord({ status: 'processing' }))

			await service.setStatus(BigInt(10), 'processing')

			expect(prisma.product.updateMany).toHaveBeenCalledWith({
				where: { id: BigInt(1), stockQty: { gte: 2 } },
				data: { stockQty: { decrement: 2 } }
			})
		})

		it('відновлення блокується, якщо залишку вже не вистачає', async () => {
			prisma.order.findUnique.mockResolvedValue(orderRecord({ status: 'canceled' }))
			prisma.product.updateMany.mockResolvedValue({ count: 0 })

			await expect(service.setStatus(BigInt(10), 'processing')).rejects.toBeInstanceOf(
				ConflictException
			)
			expect(prisma.order.update).not.toHaveBeenCalled()
		})

		it('перехід між активними статусами не чіпає залишки', async () => {
			prisma.order.findUnique.mockResolvedValue(orderRecord({ status: 'new' }))
			prisma.order.update.mockResolvedValue(orderRecord({ status: 'shipped' }))

			await service.setStatus(BigInt(10), 'shipped')

			expect(prisma.product.updateMany).not.toHaveBeenCalled()
		})

		it('той самий статус — no-op без транзакції', async () => {
			prisma.order.findUnique.mockResolvedValue(orderRecord({ status: 'new' }))

			const res = await service.setStatus(BigInt(10), 'new')

			expect(res.status).toBe('new')
			expect(prisma.$transaction).not.toHaveBeenCalled()
			expect(prisma.order.update).not.toHaveBeenCalled()
		})

		it('кидає NotFound, якщо замовлення немає', async () => {
			prisma.order.findUnique.mockResolvedValue(null)

			await expect(service.setStatus(BigInt(404), 'done')).rejects.toBeInstanceOf(
				NotFoundException
			)
		})
	})

	describe('findByNumber (публічно)', () => {
		it('віддає лише безпечні поля — без customer/delivery/items (PII)', async () => {
			prisma.order.findUnique.mockResolvedValue(orderRecord())

			const res = await service.findByNumber('TL-2026-000001')

			expect(res).toEqual({
				orderNumber: 'TL-2026-000001',
				status: 'new',
				total: '3000.5',
				createdAt: '2026-07-01T10:00:00.000Z',
				payment: { method: 'card', status: 'pending' }
			})
			expect(Object.keys(res).sort()).toEqual([
				'createdAt',
				'orderNumber',
				'payment',
				'status',
				'total'
			])
		})

		it('кидає NotFound за невідомим номером', async () => {
			prisma.order.findUnique.mockResolvedValue(null)

			await expect(service.findByNumber('TL-2026-999999')).rejects.toBeInstanceOf(
				NotFoundException
			)
		})
	})

	describe('findAll (адмін)', () => {
		it('пагінація + пошук за номером; форма {items,total,page,limit}', async () => {
			prisma.order.findMany.mockResolvedValue([orderRecord()])
			prisma.order.count.mockResolvedValue(41)

			const res = await service.findAll({ q: 'tl-2026', page: 2, limit: 20 })

			expect(prisma.order.findMany).toHaveBeenCalledWith({
				where: { orderNumber: { contains: 'tl-2026', mode: 'insensitive' } },
				orderBy: { createdAt: 'desc' },
				skip: 20,
				take: 20,
				include: { items: true }
			})
			expect(res.total).toBe(41)
			expect(res.page).toBe(2)
			expect(res.limit).toBe(20)
			expect(res.items[0].id).toBe('10')
		})

		it('обрізає limit до 100', async () => {
			prisma.order.findMany.mockResolvedValue([])
			prisma.order.count.mockResolvedValue(0)

			const res = await service.findAll({ limit: 500 })

			expect(res.limit).toBe(100)
		})
	})

	describe('listForUser (кабінет)', () => {
		it('замовлення користувача, новіші першими, максимум 50', async () => {
			prisma.order.findMany.mockResolvedValue([orderRecord()])

			const res = await service.listForUser(BigInt(7))

			expect(prisma.order.findMany).toHaveBeenCalledWith({
				where: { userId: BigInt(7) },
				orderBy: { createdAt: 'desc' },
				take: 50,
				include: { items: true }
			})
			expect(Array.isArray(res)).toBe(true)
			expect(res[0].customer).toEqual({
				name: 'Іван',
				phone: '+380501112233',
				email: null
			})
		})
	})

	describe('findById (адмін)', () => {
		it('кидає BadRequest на невалідний id', async () => {
			await expect(service.findById('abc')).rejects.toBeInstanceOf(BadRequestException)
		})

		it('кидає NotFound, якщо замовлення немає', async () => {
			prisma.order.findUnique.mockResolvedValue(null)
			await expect(service.findById('404')).rejects.toBeInstanceOf(NotFoundException)
		})

		it('повертає повну форму', async () => {
			prisma.order.findUnique.mockResolvedValue(orderRecord())

			const res = await service.findById('10')

			expect(res.id).toBe('10')
			expect(res.customer).toBeDefined()
			expect(res.items).toHaveLength(1)
		})
	})
})
