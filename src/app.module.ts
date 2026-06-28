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
import { ContentBlocksModule } from './modules/content-blocks/content-blocks.module'

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
		ContentBlocksModule
		// Далі: OrdersModule, LeadsModule, …
	]
})
export class AppModule {}
