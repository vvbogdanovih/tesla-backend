import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { Response } from 'express'

/**
 * Перетворює відомі помилки Prisma на акуратні HTTP-відповіді.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
	catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
		const res = host.switchToHttp().getResponse<Response>()

		switch (exception.code) {
			case 'P2002': {
				const target = (exception.meta?.target as string[])?.join(', ') ?? 'поле'
				return res.status(HttpStatus.CONFLICT).json({
					statusCode: HttpStatus.CONFLICT,
					error: 'Conflict',
					message: `Запис із таким значенням уже існує (${target})`
				})
			}
			case 'P2025':
				return res.status(HttpStatus.NOT_FOUND).json({
					statusCode: HttpStatus.NOT_FOUND,
					error: 'Not Found',
					message: 'Запис не знайдено'
				})
			default:
				return res.status(HttpStatus.BAD_REQUEST).json({
					statusCode: HttpStatus.BAD_REQUEST,
					error: 'Bad Request',
					message: 'Помилка бази даних'
				})
		}
	}
}
