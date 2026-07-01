import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { ProductsService } from './products.service'
import { CreateProductDto } from './dto/create-product.dto'

// rich-text мокаємо, щоб не тягнути happy-dom у unit-середовище
jest.mock('src/common/rich-text/rich-text.util', () => ({
	richTextToHtml: jest.fn((doc: unknown) => (doc ? '<p>html</p>' : ''))
}))

type PrismaMock = {
	product: {
		findMany: jest.Mock
		findUnique: jest.Mock
		create: jest.Mock
		update: jest.Mock
		delete: jest.Mock
	}
	category: { findUnique: jest.Mock }
	car: { count: jest.Mock }
	orderItem: { count: jest.Mock }
}

const baseDto = (over: Partial<CreateProductDto> = {}): CreateProductDto => ({
	name: 'Фара ліва',
	sku: 'SKU-1',
	categoryId: '1',
	price: 100,
	type: 'original',
	...over
})

describe('ProductsService', () => {
	let service: ProductsService
	let prisma: PrismaMock

	beforeEach(() => {
		prisma = {
			product: {
				findMany: jest.fn(),
				findUnique: jest.fn(),
				create: jest.fn(),
				update: jest.fn(),
				delete: jest.fn()
			},
			category: { findUnique: jest.fn() },
			car: { count: jest.fn() },
			orderItem: { count: jest.fn() }
		}
		service = new ProductsService(prisma as never)
	})

	describe('create', () => {
		it('створює товар: auto-slug, descriptionHtml із JSON, fitment, images', async () => {
			prisma.category.findUnique.mockResolvedValue({ id: BigInt(1) })
			prisma.car.count.mockResolvedValue(2)
			prisma.product.findUnique.mockResolvedValue(null) // sku вільний + slug вільний
			prisma.product.create.mockResolvedValue({ id: BigInt(10) })

			await service.create(
				baseDto({
					carIds: ['2', '3'],
					descriptionJson: { type: 'doc' },
					images: [{ url: 'u1', alt: 'фото' }, { url: 'u2' }],
					livePhotos: [{ url: 'live1' }]
				})
			)

			const data = prisma.product.create.mock.calls[0][0].data
			expect(data.slug).toBe('fara-liva')
			expect(data.sku).toBe('SKU-1')
			expect(data.descriptionHtml).toBe('<p>html</p>')
			expect(data.fitment.create).toEqual([{ carId: BigInt(2) }, { carId: BigInt(3) }])
			// галерея (isLive:false) + живі фото (isLive:true) в одному наборі
			expect(data.images.create).toEqual([
				{ url: 'u1', alt: 'фото', sortOrder: 0, isLive: false },
				{ url: 'u2', alt: null, sortOrder: 1, isLive: false },
				{ url: 'live1', alt: null, sortOrder: 0, isLive: true }
			])
		})

		it('додає суфікс до slug при колізії', async () => {
			prisma.category.findUnique.mockResolvedValue({ id: BigInt(1) })
			prisma.product.findUnique
				.mockResolvedValueOnce(null) // sku вільний
				.mockResolvedValueOnce({ id: BigInt(5) }) // slug "fara-liva" зайнятий
				.mockResolvedValueOnce(null) // "fara-liva-2" вільний
			prisma.product.create.mockResolvedValue({ id: BigInt(11) })

			await service.create(baseDto())

			expect(prisma.product.create.mock.calls[0][0].data.slug).toBe('fara-liva-2')
		})

		it('кидає Conflict, якщо SKU зайнятий', async () => {
			prisma.category.findUnique.mockResolvedValue({ id: BigInt(1) })
			prisma.product.findUnique.mockResolvedValueOnce({ id: BigInt(9) }) // sku зайнятий

			await expect(service.create(baseDto())).rejects.toBeInstanceOf(ConflictException)
			expect(prisma.product.create).not.toHaveBeenCalled()
		})

		it('кидає NotFound, якщо категорії немає', async () => {
			prisma.category.findUnique.mockResolvedValue(null)

			await expect(service.create(baseDto({ categoryId: '999' }))).rejects.toBeInstanceOf(
				NotFoundException
			)
			expect(prisma.product.create).not.toHaveBeenCalled()
		})

		it('кидає NotFound, якщо якесь авто сумісності не існує', async () => {
			prisma.category.findUnique.mockResolvedValue({ id: BigInt(1) })
			prisma.car.count.mockResolvedValue(1) // знайдено 1 із 2

			await expect(service.create(baseDto({ carIds: ['2', '3'] }))).rejects.toBeInstanceOf(
				NotFoundException
			)
		})

		it('кидає BadRequest на невалідний categoryId', async () => {
			await expect(service.create(baseDto({ categoryId: 'abc' }))).rejects.toBeInstanceOf(
				BadRequestException
			)
		})
	})

	describe('update', () => {
		it('оновлює ціну та повністю замінює сумісність', async () => {
			prisma.product.findUnique.mockResolvedValue({ id: BigInt(1) }) // ensureExists
			prisma.car.count.mockResolvedValue(1)
			prisma.product.update.mockResolvedValue({ id: BigInt(1) })

			await service.update(BigInt(1), { price: 200, carIds: ['2'] })

			const data = prisma.product.update.mock.calls[0][0].data
			expect(data.price).toBe(200)
			expect(data.fitment).toEqual({ deleteMany: {}, create: [{ carId: BigInt(2) }] })
		})

		it('регенерує descriptionHtml при зміні опису', async () => {
			prisma.product.findUnique.mockResolvedValue({ id: BigInt(1) })
			prisma.product.update.mockResolvedValue({ id: BigInt(1) })

			await service.update(BigInt(1), { descriptionJson: { type: 'doc' } })

			expect(prisma.product.update.mock.calls[0][0].data.descriptionHtml).toBe('<p>html</p>')
		})

		it('кидає Conflict при зміні SKU на зайнятий іншим товаром', async () => {
			prisma.product.findUnique
				.mockResolvedValueOnce({ id: BigInt(1) }) // ensureExists
				.mockResolvedValueOnce({ id: BigInt(2) }) // ensureSkuFree: SKU за іншим товаром

			await expect(service.update(BigInt(1), { sku: 'TAKEN' })).rejects.toBeInstanceOf(
				ConflictException
			)
			expect(prisma.product.update).not.toHaveBeenCalled()
		})

		it('дозволяє зберегти власний SKU без конфлікту', async () => {
			prisma.product.findUnique
				.mockResolvedValueOnce({ id: BigInt(1) }) // ensureExists
				.mockResolvedValueOnce({ id: BigInt(1) }) // ensureSkuFree: той самий товар
			prisma.product.update.mockResolvedValue({ id: BigInt(1) })

			await service.update(BigInt(1), { sku: 'OWN' })

			expect(prisma.product.update.mock.calls[0][0].data.sku).toBe('OWN')
		})

		it('повністю замінює галерею (deleteMany + create), не чіпаючи живі фото', async () => {
			prisma.product.findUnique.mockResolvedValue({ id: BigInt(1) })
			prisma.product.update.mockResolvedValue({ id: BigInt(1) })

			await service.update(BigInt(1), { images: [{ url: 'x', alt: 'a' }] })

			// передано лише images → заміщуємо тільки набір isLive:false
			expect(prisma.product.update.mock.calls[0][0].data.images).toEqual({
				deleteMany: [{ isLive: false }],
				create: [{ url: 'x', alt: 'a', sortOrder: 0, isLive: false }]
			})
		})

		it('замінює галерею та живі фото незалежними наборами', async () => {
			prisma.product.findUnique.mockResolvedValue({ id: BigInt(1) })
			prisma.product.update.mockResolvedValue({ id: BigInt(1) })

			await service.update(BigInt(1), {
				images: [{ url: 'g' }],
				livePhotos: [{ url: 'l1' }, { url: 'l2' }]
			})

			expect(prisma.product.update.mock.calls[0][0].data.images).toEqual({
				deleteMany: [{ isLive: false }, { isLive: true }],
				create: [
					{ url: 'g', alt: null, sortOrder: 0, isLive: false },
					{ url: 'l1', alt: null, sortOrder: 0, isLive: true },
					{ url: 'l2', alt: null, sortOrder: 1, isLive: true }
				]
			})
		})

		it('не змінює slug при зміні лише назви (SEO-стабільність)', async () => {
			prisma.product.findUnique.mockResolvedValue({ id: BigInt(1) })
			prisma.product.update.mockResolvedValue({ id: BigInt(1) })

			await service.update(BigInt(1), { name: 'Нова назва' })

			const data = prisma.product.update.mock.calls[0][0].data
			expect(data.name).toBe('Нова назва')
			expect(data.slug).toBeUndefined()
		})

		it('кидає NotFound, якщо товару немає', async () => {
			prisma.product.findUnique.mockResolvedValue(null)

			await expect(service.update(BigInt(99), { price: 1 })).rejects.toBeInstanceOf(
				NotFoundException
			)
		})
	})

	describe('remove', () => {
		it('блокує видалення товару, що є в замовленнях', async () => {
			prisma.product.findUnique.mockResolvedValue({ id: BigInt(1) })
			prisma.orderItem.count.mockResolvedValue(2)

			await expect(service.remove(BigInt(1))).rejects.toBeInstanceOf(ConflictException)
			expect(prisma.product.delete).not.toHaveBeenCalled()
		})

		it('видаляє товар без замовлень', async () => {
			prisma.product.findUnique.mockResolvedValue({ id: BigInt(1) })
			prisma.orderItem.count.mockResolvedValue(0)
			prisma.product.delete.mockResolvedValue({ id: BigInt(1) })

			const res = await service.remove(BigInt(1))

			expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: BigInt(1) } })
			expect(res).toEqual({ ok: true })
		})
	})

	describe('findOne', () => {
		it('кидає NotFound, якщо товару немає', async () => {
			prisma.product.findUnique.mockResolvedValue(null)
			await expect(service.findOne(BigInt(404))).rejects.toBeInstanceOf(NotFoundException)
		})
	})
})
