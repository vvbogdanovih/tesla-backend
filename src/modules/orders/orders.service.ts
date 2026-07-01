import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { OrderStatus, Prisma } from '@prisma/client'
import { PrismaService } from 'src/database/prisma/prisma.service'
import { CreateOrderDto } from './dto/create-order.dto'

@Injectable()
export class OrdersService {
	constructor(private readonly prisma: PrismaService) {}

	async create(dto: CreateOrderDto, userId?: bigint) {
		// Готівка — лише при самовивозі
		if (dto.paymentMethod === 'cash' && dto.delivery.method !== 'pickup') {
			throw new BadRequestException('Готівка доступна лише при самовивозі')
		}

		// Знімок позицій із актуальних цін на сервері (клієнтським цінам не довіряємо)
		const ids = dto.items.map(i => {
			try {
				return BigInt(i.productId)
			} catch {
				throw new BadRequestException('Невірний productId у кошику')
			}
		})
		const products = await this.prisma.product.findMany({
			where: { id: { in: ids }, isActive: true },
			select: { id: true, name: true, sku: true, price: true }
		})
		const byId = new Map(products.map(p => [p.id.toString(), p]))

		const itemsData = dto.items.map(i => {
			const p = byId.get(BigInt(i.productId).toString())
			if (!p) throw new BadRequestException(`Товар недоступний: ${i.productId}`)
			return { productId: p.id, name: p.name, sku: p.sku, price: p.price, qty: i.qty }
		})
		const total = itemsData.reduce((sum, i) => sum + Number(i.price) * i.qty, 0)

		const customer = {
			name: dto.customer.name.trim(),
			phone: dto.customer.phone.trim(),
			email: dto.customer.email?.trim() || null
		}
		const delivery = {
			method: dto.delivery.method,
			city: dto.delivery.city?.trim() || null,
			warehouse: dto.delivery.warehouse?.trim() || null
		}
		const payment = { method: dto.paymentMethod, status: 'pending' as const }

		// Унікальний людиночитабельний номер TL-РРРР-NNNNNN (із ретраєм на колізію)
		const order = await this.createWithNumber({
			userId: userId ?? null,
			customer,
			delivery,
			payment,
			total,
			comment: dto.comment?.trim() || null,
			itemsData
		})
		return this.toPublic(order)
	}

	private async createWithNumber(p: {
		userId: bigint | null
		customer: object
		delivery: object
		payment: object
		total: number
		comment: string | null
		itemsData: { productId: bigint; name: string; sku: string; price: Prisma.Decimal; qty: number }[]
	}) {
		const year = new Date().getFullYear()
		const prefix = `TL-${year}-`
		const count = await this.prisma.order.count({ where: { orderNumber: { startsWith: prefix } } })

		for (let attempt = 0; attempt < 5; attempt++) {
			const orderNumber = `${prefix}${String(count + 1 + attempt).padStart(6, '0')}`
			try {
				return await this.prisma.order.create({
					data: {
						orderNumber,
						userId: p.userId,
						customer: p.customer as Prisma.InputJsonValue,
						delivery: p.delivery as Prisma.InputJsonValue,
						payment: p.payment as Prisma.InputJsonValue,
						total: p.total,
						comment: p.comment,
						items: { create: p.itemsData }
					},
					include: { items: true }
				})
			} catch (e) {
				if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue
				throw e
			}
		}
		throw new BadRequestException('Не вдалося згенерувати номер замовлення, спробуйте ще раз')
	}

	// Публічно — статус/підтвердження за номером (клієнт знає свій номер)
	async findByNumber(orderNumber: string) {
		const order = await this.prisma.order.findUnique({
			where: { orderNumber },
			include: { items: true }
		})
		if (!order) throw new NotFoundException('Замовлення не знайдено')
		return this.toPublic(order)
	}

	// Адмін
	findAll(status?: OrderStatus) {
		return this.prisma.order.findMany({
			where: status ? { status } : {},
			orderBy: { createdAt: 'desc' },
			include: { items: true }
		})
	}

	async setStatus(id: bigint, status: OrderStatus) {
		const exists = await this.prisma.order.findUnique({ where: { id }, select: { id: true } })
		if (!exists) throw new NotFoundException('Замовлення не знайдено')
		return this.prisma.order.update({ where: { id }, data: { status }, include: { items: true } })
	}

	private toPublic<T extends { orderNumber: string }>(order: T) {
		return order
	}
}
