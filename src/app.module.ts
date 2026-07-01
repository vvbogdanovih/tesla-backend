import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { LoggerModule } from 'nestjs-pino'

import { ENV } from './common/constants'
import { PrismaModule } from './database/prisma/prisma.module'
import { HealthModule } from './modules/health/health.module'
import { AuthModule } from './modules/auth/auth.module'
import { S3Module } from './modules/s3/s3.module'
import { CarsModule } from './modules/cars/cars.module'
import { CategoriesModule } from './modules/categories/categories.module'
import { ProductsModule } from './modules/products/products.module'
import { CatalogModule } from './modules/catalog/catalog.module'
import { ContentBlocksModule } from './modules/content-blocks/content-blocks.module'
import { PaymentRequisitesModule } from './modules/payment-requisites/payment-requisites.module'
import { LeadsModule } from './modules/leads/leads.module'
import { OrdersModule } from './modules/orders/orders.module'
import { StatsModule } from './modules/stats/stats.module'

@Module({
	imports: [
		LoggerModule.forRoot({
			pinoHttp: {
				level: ENV.LOG_LEVEL,
				transport:
					ENV.NODE_ENV !== 'production'
						? { target: 'pino-pretty', options: { colorize: true } }
						: undefined,
				autoLogging: true
			}
		}),
		ScheduleModule.forRoot(),
		PrismaModule,
		HealthModule,
		AuthModule,
		S3Module,
		CarsModule,
		CategoriesModule,
		ProductsModule,
		CatalogModule,
		ContentBlocksModule,
		PaymentRequisitesModule,
		LeadsModule,
		OrdersModule,
		StatsModule
		// Далі: PaymentModule (LiqPay/Monopay), CartModule, …
	]
})
export class AppModule {}
