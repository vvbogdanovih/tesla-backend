import { StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { rmSync } from 'node:fs'
import { join } from 'node:path'

// Зупиняє й видаляє тестовий контейнер після e2e — жодних слідів.
export default async function globalTeardown() {
	const container = (globalThis as unknown as { __PG__?: StartedPostgreSqlContainer }).__PG__
	if (container) {
		await container.stop({ remove: true })
		console.log('🧹 Тестовий Postgres зупинено й видалено')
	}
	try {
		rmSync(join(__dirname, '.db-url'))
	} catch {
		// файл міг не створитись — ігноруємо
	}
}
