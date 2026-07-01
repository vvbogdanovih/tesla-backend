import { NotFoundException } from '@nestjs/common'
import { CatalogService } from './catalog.service'

type PrismaMock = {
	product: { findMany: jest.Mock; count: jest.Mock; findFirst: jest.Mock }
	$transaction: jest.Mock
	$queryRaw: jest.Mock
}

describe('CatalogService', () => {
	let service: CatalogService
	let prisma: PrismaMock

	beforeEach(() => {
		prisma = {
			product: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn() },
			$transaction: jest.fn(),
			$queryRaw: jest.fn()
		}
		service = new CatalogService(prisma as never)
	})

	describe('list', () => {
		it('будує where з фільтрів і повертає пагінацію', async () => {
			prisma.product.findMany.mockReturnValue('FM')
			prisma.product.count.mockReturnValue('CNT')
			prisma.$transaction.mockResolvedValue([
				[
					{ id: 1n, _count: { images: 2 } },
					{ id: 2n, _count: { images: 0 } }
				],
				2
			])

			const res = await service.list({
				category: 'kuzov',
				car: 'model-3,model-y',
				type: 'original',
				inStock: 'true',
				minPrice: 100,
				maxPrice: 5000,
				sort: 'price_desc',
				page: 1,
				limit: 10
			})

			expect(res).toMatchObject({ total: 2, page: 1, limit: 10, pages: 1 })
			// _count.images (живі фото) → hasLivePhotos; сам _count у відповідь не потрапляє
			expect(res.items[0]).toEqual({ id: 1n, hasLivePhotos: true })
			expect(res.items[1]).toEqual({ id: 2n, hasLivePhotos: false })
			const arg = prisma.product.findMany.mock.calls[0][0]
			expect(arg.where.isActive).toBe(true)
			expect(arg.where.category).toEqual({ slug: 'kuzov' })
			expect(arg.where.fitment).toEqual({
				some: { car: { slug: { in: ['model-3', 'model-y'] } } }
			})
			expect(arg.where.type).toBe('original')
			expect(arg.where.stockQty).toEqual({ gt: 0 })
			expect(arg.where.price).toEqual({ gte: 100, lte: 5000 })
			expect(arg.orderBy).toEqual({ price: 'desc' })
		})

		it('лише активні + дефолтна пагінація без фільтрів', async () => {
			prisma.product.findMany.mockReturnValue('FM')
			prisma.product.count.mockReturnValue('CNT')
			prisma.$transaction.mockResolvedValue([[], 0])

			const res = await service.list({})

			const arg = prisma.product.findMany.mock.calls[0][0]
			expect(arg.where).toEqual({ isActive: true })
			expect(res).toMatchObject({ page: 1, limit: 24, pages: 1 })
		})
	})

	describe('bySlug', () => {
		it('кидає NotFound, якщо немає активного товару', async () => {
			prisma.product.findFirst.mockResolvedValue(null)
			await expect(service.bySlug('nope')).rejects.toBeInstanceOf(NotFoundException)
		})

		it('повертає публічну форму: cars зі сумісності, без descriptionJson', async () => {
			prisma.product.findFirst.mockResolvedValue({
				id: 1n,
				slug: 'fara',
				sku: 'F-1',
				name: 'Фара',
				price: '4500',
				oldPrice: null,
				onSale: false,
				type: 'original',
				condition: 'new',
				stockQty: 3,
				attributes: {},
				descriptionJson: { type: 'doc' },
				descriptionHtml: '<p>опис</p>',
				seo: {},
				category: { name: 'Кузов', slug: 'kuzov' },
				images: [
					{ url: 'u', alt: 'a', id: 1n, productId: 1n, sortOrder: 0, isLive: false },
					{ url: 'live', alt: 'l', id: 2n, productId: 1n, sortOrder: 0, isLive: true }
				],
				fitment: [
					{
						car: {
							id: 2n,
							model: 'Model 3',
							generation: 'Highland',
							slug: 'model-3-highland'
						}
					}
				]
			})

			const res = await service.bySlug('fara')

			expect(res.cars).toEqual([
				{ id: 2n, model: 'Model 3', generation: 'Highland', slug: 'model-3-highland' }
			])
			// галерея та живі фото розділяються за isLive
			expect(res.images).toEqual([{ url: 'u', alt: 'a' }])
			expect(res.livePhotos).toEqual([{ url: 'live', alt: 'l' }])
			expect(res.descriptionHtml).toBe('<p>опис</p>')
			expect('descriptionJson' in res).toBe(false)
		})
	})

	describe('search', () => {
		it('порожній запит → [] без запиту в БД', async () => {
			const res = await service.search('   ')
			expect(res).toEqual([])
			expect(prisma.$queryRaw).not.toHaveBeenCalled()
		})

		it('зберігає порядок за релевантністю з pg_trgm', async () => {
			prisma.$queryRaw.mockResolvedValue([{ id: 2n }, { id: 1n }])
			prisma.product.findMany.mockResolvedValue([
				{ id: 1n, slug: 'a', sku: 'A', name: 'A', price: '1', images: [] },
				{ id: 2n, slug: 'b', sku: 'B', name: 'B', price: '2', images: [] }
			])

			const res = await service.search('бампер')

			expect(prisma.$queryRaw).toHaveBeenCalled()
			expect(res.map(r => (r as { id: bigint }).id)).toEqual([2n, 1n]) // порядок із $queryRaw
		})
	})
})
