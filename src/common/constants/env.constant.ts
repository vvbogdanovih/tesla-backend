import { z } from 'zod'
import { fromZodError } from 'zod-validation-error'
import 'dotenv/config'

const envSchema = z.object({
	DATABASE_URL: z.string().min(1),

	// Auth
	JWT_SECRET: z.string().min(10),
	JWT_EXPIRATION: z.coerce.number(),
	ACCESS_TOKEN_NAME: z.string().min(1).default('tesla_access'),
	REFRESH_JWT_SECRET: z.string().min(10),
	REFRESH_JWT_EXPIRATION: z.coerce.number(),
	REFRESH_TOKEN_NAME: z.string().min(1).default('tesla_refresh'),
	PASSWORD_PEPPER: z.string().min(16),

	// Фронти (CORS)
	FRONTEND_URL: z.string().min(1).default('http://localhost:3000'),
	ADMIN_URL: z.string().min(1).default('http://localhost:3001'),

	// S3 (опційно на старті, обовʼязково для медіа)
	AWS_REGION: z.string().optional(),
	AWS_ACCESS_KEY_ID: z.string().optional(),
	AWS_SECRET_ACCESS_KEY: z.string().optional(),
	AWS_S3_BUCKET_NAME: z.string().optional(),
	AWS_S3_PUBLIC_URL: z.string().url().optional(),

	// Інтеграції (опційно на старті)
	NOVA_POSHTA_API_KEY: z.string().optional(),
	PAYMENT_PROVIDER: z.string().optional(), // liqpay | fondy | wayforpay | monobank
	PAYMENT_PUBLIC_KEY: z.string().optional(),
	PAYMENT_PRIVATE_KEY: z.string().optional(),

	// Email
	RESEND_API_KEY: z.string().optional(),
	SERVICE_EMAIL: z.string().email().optional(),
	ALLOW_EMAIL_SENDING: z.coerce.boolean().default(false),

	PORT: z.coerce.number().default(4000),
	NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
	LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

	// Вмикає in-process крони (нотифікації, синхронізації). Тримати true лише
	// на одному інстансі при кількох репліках.
	RUN_CRON: z
		.string()
		.optional()
		.transform(v => v === 'true' || v === '1')
})

type EnvSchema = z.infer<typeof envSchema>

const getParsedEnv = (): EnvSchema => {
	// Порожні значення (`KEY=`) трактуємо як відсутні — щоб опційні поля
	// (url/email/інтеграції) не падали на валідації порожнього рядка.
	const raw = Object.fromEntries(
		Object.entries(process.env).map(([k, v]) => [k, v === '' ? undefined : v])
	)
	const result = envSchema.safeParse(raw)
	if (!result.success) {
		throw new Error(fromZodError(result.error).toString())
	}
	return result.data
}

export const ENV = getParsedEnv()
