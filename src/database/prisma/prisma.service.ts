import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { ENV } from 'src/common/constants'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(PrismaService.name)

	constructor() {
		const adapter = new PrismaPg({ connectionString: ENV.DATABASE_URL })
		super({ adapter })
	}

	async onModuleInit() {
		try {
			await this.$connect()
			this.logger.log('Підключено до бази даних')
		} catch (error) {
			this.logger.error('Не вдалося підключитися до бази даних', error as Error)
			throw error
		}
	}

	async onModuleDestroy() {
		await this.$disconnect()
	}
}
