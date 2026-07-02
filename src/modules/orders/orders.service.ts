import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException
} from '@nestjs/common'
import { Order, OrderItem, OrderStatus, Prisma } from '@prisma/client'
import { PrismaService } from 'src/database/prisma/prisma.service'
import { CreateOrderDto } from './dto/create-order.dto'
import { OrdersAdminQueryDto } from './dto/orders-admin-query.dto'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const ACCOUNT_ORDERS_LIMIT = 50

type OrderWithItems = Order & { items: OrderItem[] }

@Injectable()
export class OrdersService {
	constructor(private readonly prisma: PrismaService) {}

	async create(dto: CreateOrderDto, userId?: bigint) {
		// Готівка — лише при самовивозі
		if (dto.paymentMethod === 'cash' && dto.delivery.method !== 'pickup') {
			throw new BadRequestException('Готівка доступна лише при самовивозі')
		}

		const ids = dto.items.map(i => {
			try {
				return BigInt(i.productId)
			} catch {
				throw new BadRequestException('Невірний productId у кошику')
			}
		})

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

		// Унікальний людиночитабельний номер TL-РРРР-NNNNNN;
		// колізія номера (P2002) скасовує транзакцію цілком — повторюємо спробу заново
		const prefix = `TL-${new Date().getFullYear()}-`

		for (let attempt = 0; attempt < 5; attempt++) {
			try {
				const order = await this.prisma.$transaction(async tx => {
					// Знімок позицій із актуальних цін на сервері (клієнтським цінам не довіряємо)
					const products = await tx.product.findMany({
						where: { id: { in: ids }, isActive: true },
						select: { id: true, name: true, sku: true, price: true, stockQty: true }
					})
					const byId = new Map(products.map(p => [p.id.toString(), p]))

					const itemsData = dto.items.map(i => {
						const p = byId.get(BigInt(i.productId).toString())
						if (!p) throw new BadRequestException(`Товар недоступний: ${i.productId}`)
						return {
							productId: p.id,
							name: p.name,
							sku: p.sku,
							price: p.price,
							qty: i.qty
						}
					})

					// Атомарна перевірка + списання залишку (захист від oversell)
					for (const item of itemsData) {
						const res = await tx.product.updateMany({
							where: { id: item.productId, stockQty: { gte: item.qty } },
							data: { stockQty: { decrement: item.qty } }
						})
						if (res.count === 0) {
							const available = byId.get(item.productId.toString())?.stockQty ?? 0
							throw new ConflictException(
								`Недостатньо залишку для «${item.name}»: доступно ${available} шт.`
							)
						}
					}

					// Сума — через Decimal (без float-математики)
					const total = itemsData.reduce(
						(sum, i) => sum.plus(new Prisma.Decimal(i.price).mul(i.qty)),
						new Prisma.Decimal(0)
					)

					const count = await tx.order.count({
						where: { orderNumber: { startsWith: prefix } }
					})
					const orderNumber = `${prefix}${String(count + 1 + attempt).padStart(6, '0')}`

					return tx.order.create({
						data: {
							orderNumber,
							userId: userId ?? null,
							customer: customer,
							delivery: delivery,
							payment: payment,
							total,
							comment: dto.comment?.trim() || null,
							items: { create: itemsData }
						},
						include: { items: true }
					})
				})
				return this.toFull(order)
			} catch (e) {
				if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
					continue
				throw e
			}
		}
		throw new BadRequestException('Не вдалося згенерувати номер замовлення, спробуйте ще раз')
	}

	// Публічно — статус за номером; лише безпечні поля, без PII (customer/delivery/items)
	async findByNumber(orderNumber: string) {
		const order = await this.prisma.order.findUnique({ where: { orderNumber } })
		if (!order) throw new NotFoundException('Замовлення не знайдено')
		return this.toSafe(order)
	}

	// Кабінет — історія замовлень поточного користувача
	async listForUser(userId: bigint) {
		const orders = await this.prisma.order.findMany({
			where: { userId },
			orderBy: { createdAt: 'desc' },
			take: ACCOUNT_ORDERS_LIMIT,
			include: { items: true }
		})
		return orders.map(o => this.toFull(o))
	}

	// Адмін — список із пошуком за номером і пагінацією
	async findAll(q: OrdersAdminQueryDto) {
		const page = q.page ?? 1
		const limit = Math.min(q.limit ?? DEFAULT_LIMIT, MAX_LIMIT)

		const where: Prisma.OrderWhereInput = {}
		if (q.status) where.status = q.status
		if (q.q?.trim()) where.orderNumber = { contains: q.q.trim(), mode: 'insensitive' }

		const [rows, total] = await this.prisma.$transaction([
			this.prisma.order.findMany({
				where,
				orderBy: { createdAt: 'desc' },
				skip: (page - 1) * limit,
				take: limit,
				include: { items: true }
			}),
			this.prisma.order.count({ where })
		])

		return { items: rows.map(o => this.toFull(o)), total, page, limit }
	}

	// Адмін — повна деталь замовлення
	async findById(id: string) {
		const order = await this.prisma.order.findUnique({
			where: { id: this.parseId(id) },
			include: { items: true }
		})
		if (!order) throw new NotFoundException('Замовлення не знайдено')
		return this.toFull(order)
	}

	async setStatus(id: bigint, status: OrderStatus) {
		const order = await this.prisma.order.findUnique({
			where: { id },
			include: { items: true }
		})
		if (!order) throw new NotFoundException('Замовлення не знайдено')

		// Той самий статус — no-op
		if (order.status === status) return this.toFull(order)

		const updated = await this.prisma.$transaction(async tx => {
			if (status === 'canceled') {
				// Скасування — повертаємо залишки по позиціях, що ще мають товар
				for (const item of order.items) {
					if (!item.productId) continue
					await tx.product.updateMany({
						where: { id: item.productId },
						data: { stockQty: { increment: item.qty } }
					})
				}
			} else if (order.status === 'canceled') {
				// Відновлення зі скасованого — повторна перевірка і списання залишку
				for (const item of order.items) {
					if (!item.productId) continue
					const res = await tx.product.updateMany({
						where: { id: item.productId, stockQty: { gte: item.qty } },
						data: { stockQty: { decrement: item.qty } }
					})
					if (res.count === 0) {
						throw new ConflictException(
							`Недостатньо залишку для «${item.name}» — неможливо відновити замовлення`
						)
					}
				}
			}

			return tx.order.update({ where: { id }, data: { status }, include: { items: true } })
		})
		return this.toFull(updated)
	}

	private parseId(id: string): bigint {
		try {
			return BigInt(id)
		} catch {
			throw new BadRequestException('Невірний id замовлення')
		}
	}

	// Публічна відповідь за номером — лише безпечні поля (захист від перебору номерів)
	private toSafe(order: Order) {
		const payment = (order.payment ?? {}) as { method?: string; status?: string }
		return {
			orderNumber: order.orderNumber,
			status: order.status,
			total: order.total.toString(),
			createdAt: order.createdAt.toISOString(),
			payment: { method: payment.method ?? null, status: payment.status ?? null }
		}
	}

	// Повна форма замовлення (POST /orders, кабінет, адмінка) — BigInt/Decimal як рядки
	private toFull(order: OrderWithItems) {
		return {
			id: order.id.toString(),
			orderNumber: order.orderNumber,
			status: order.status,
			total: order.total.toString(),
			createdAt: order.createdAt.toISOString(),
			customer: order.customer,
			delivery: order.delivery,
			payment: order.payment,
			comment: order.comment,
			isOneClick: order.isOneClick,
			items: order.items.map(i => ({
				id: i.id.toString(),
				productId: i.productId?.toString() ?? null,
				name: i.name,
				sku: i.sku,
				price: i.price.toString(),
				qty: i.qty
			}))
		}
	}
}
