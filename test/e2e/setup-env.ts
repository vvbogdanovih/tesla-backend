import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Виконується в кожному воркері ДО імпорту застосунку: підставляє DATABASE_URL
// тестового контейнера (з файлу) + інші обовʼязкові env для zod-валідації.
try {
	process.env.DATABASE_URL = readFileSync(join(__dirname, '.db-url'), 'utf8').trim()
} catch {
	// якщо файлу немає — лишаємо як є (тест впаде з ясною помилкою підключення)
}

process.env.JWT_SECRET ||= 'test-jwt-secret'
process.env.JWT_EXPIRATION ||= '900'
process.env.REFRESH_JWT_SECRET ||= 'test-refresh-secret'
process.env.REFRESH_JWT_EXPIRATION ||= '2592000'
process.env.PASSWORD_PEPPER ||= 'test-pepper-min-16-characters'
process.env.NODE_ENV ||= 'test'

// BigInt → string у JSON (як у main.ts; тут застосунок піднімається без main).
;(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
	return this.toString()
}
