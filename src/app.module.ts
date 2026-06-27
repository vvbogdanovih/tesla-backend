import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { LoggerModule } from 'nestjs-pino'

import { ENV } from './common/constants'
import { PrismaModule } from './database/prisma/prisma.module'
import { HealthModule } from './modules/health/health.module'

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
		HealthModule
		// Доменні модулі додаються тут: AuthModule, CatalogModule, CarsModule, …
	]
})
export class AppModule {}
