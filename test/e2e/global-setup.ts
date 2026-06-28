import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Піднімає ефемерний Postgres у Docker, застосовує міграції Prisma.
// URL передаємо у воркери через файл (env, заданий тут, до них не доходить).
export default async function globalSetup() {
	const container = await new PostgreSqlContainer('postgres:16-alpine').start()
	const url = container.getConnectionUri()

	execSync('npx prisma migrate deploy', {
		stdio: 'inherit',
		env: { ...process.env, DATABASE_URL: url }
	})

	writeFileSync(join(__dirname, '.db-url'), url)
	;(globalThis as unknown as { __PG__: StartedPostgreSqlContainer }).__PG__ = container
	console.log('\n🐘 Тестовий Postgres піднято (Testcontainers)')
}
