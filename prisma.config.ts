import 'dotenv/config'
import path from 'node:path'
import { defineConfig, env } from 'prisma/config'

const PRISMA_DIR = path.resolve('src/database/prisma')

export default defineConfig({
	schema: path.join(PRISMA_DIR, '/schemas'),
	datasource: {
		url: env('DATABASE_URL')
	},
	migrations: {
		path: path.join(PRISMA_DIR, '/migrations'),
		seed: 'npx ts-node -r tsconfig-paths/register src/database/prisma/seed.ts'
	}
})
