import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/database/prisma/prisma.service'

export interface DashboardStats {
	ordersThisMonth: number
	revenueThisMonth: number
	newLeads: number
	productsCount: number
}

@Injectable()
export class StatsService {
	constructor(private readonly prisma: PrismaService) {}

	async dashboard(): Promise<DashboardStats> {
		const now = new Date()
		const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

		const [ordersThisMonth, revenueAgg, newLeads, productsCount] = await Promise.all([
			// усі замовлення, створені цього місяця
			this.prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
			// дохід місяця — сума по нескасованих замовленнях
			this.prisma.order.aggregate({
				_sum: { total: true },
				where: { createdAt: { gte: monthStart }, status: { not: 'canceled' } }
			}),
			// нові (необроблені) ліди
			this.prisma.lead.count({ where: { status: 'new' } }),
			// товарів у каталозі
			this.prisma.product.count()
		])

		return {
			ordersThisMonth,
			revenueThisMonth: Number(revenueAgg._sum.total ?? 0),
			newLeads,
			productsCount
		}
	}
}
