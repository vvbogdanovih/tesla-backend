import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { Logger } from 'nestjs-pino'
import cookieParser from 'cookie-parser'
import { AppModule } from './app.module'
import { ENV } from './common/constants'
import { PrismaExceptionFilter } from './database/prisma/prisma.filter'

// BigInt → string у JSON (id-шники BigInt серіалізуються коректно)
;(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
	return this.toString()
}

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule, {
		bufferLogs: true
	})
	app.set('trust proxy', 1)
	app.useLogger(app.get(Logger))
	app.setGlobalPrefix('api')
	app.useGlobalFilters(new PrismaExceptionFilter())
	app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
	app.useBodyParser('json', { limit: '10mb' })
	app.use(cookieParser())
	app.enableCors({
		origin: [ENV.FRONTEND_URL, ENV.ADMIN_URL],
		credentials: true
	})

	const config = new DocumentBuilder()
		.setTitle('Tesla Lviv API')
		.setDescription('API документація tesla-backend')
		.setVersion('1.0')
		.build()
	const document = SwaggerModule.createDocument(app, config)
	SwaggerModule.setup('swagger', app, document)

	await app.listen(ENV.PORT)
}
bootstrap()
