/**
 * Створює/оновлює користувача з заданою роллю (пароль хешується argon2 + pepper).
 *
 * Використання:
 *   npx ts-node -r tsconfig-paths/register scripts/create-user.ts <email> <password> [role]
 *   role: user | admin | superadmin (за замовч. user)
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, UserRole } from '@prisma/client'
import * as argon2 from 'argon2'
import 'dotenv/config'

async function main() {
	const [email, password, roleArg] = process.argv.slice(2)
	if (!email || !password) {
		throw new Error('Вкажіть email і пароль: create-user.ts <email> <password> [role]')
	}
	const role = (roleArg as UserRole) ?? 'user'
	const pepper = process.env.PASSWORD_PEPPER
	if (!pepper) throw new Error('PASSWORD_PEPPER не заданий у .env')

	const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
	const prisma = new PrismaClient({ adapter })

	const passwordHash = await argon2.hash(password, { secret: Buffer.from(pepper) })
	const user = await prisma.user.upsert({
		where: { email },
		update: { passwordHash, role },
		create: { email, passwordHash, role }
	})

	console.log(`✅ Користувач ${user.email} (роль: ${user.role}, id: ${user.id})`)
	await prisma.$disconnect()
}

main().catch(e => {
	console.error(e)
	process.exit(1)
})
