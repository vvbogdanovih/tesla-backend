import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { LoggerModule } from 'nestjs-pino'

import { ENV } from './common/constants'
import { PrismaModule } from './database/prisma/prisma.module'
import { HealthModule } from './modules/health/health.module'
import { AuthModule } from './modules/auth/auth.module'
import { S3Module } from './modules/s3/s3.module'

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
		S3Module
		// Далі: CatalogModule, CarsModule, CategoriesModule, OrdersModule, …
	]
})
export class AppModule {}
