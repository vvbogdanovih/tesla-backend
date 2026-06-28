import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { ENV } from 'src/common/constants'

// 32-байтовий ключ із PAYMENT_ENC_KEY (будь-якої довжини) через SHA-256.
const KEY = createHash('sha256').update(ENV.PAYMENT_ENC_KEY).digest()
const ALGO = 'aes-256-gcm'

/** Шифрує секрет → "iv:tag:ciphertext" (усе base64). */
export function encryptSecret(plain: string): string {
	const iv = randomBytes(12)
	const cipher = createCipheriv(ALGO, KEY, iv)
	const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
	const tag = cipher.getAuthTag()
	return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':')
}

/** Розшифровує "iv:tag:ciphertext" назад у відкритий текст. */
export function decryptSecret(payload: string): string {
	const [ivB, tagB, dataB] = payload.split(':')
	const decipher = createDecipheriv(ALGO, KEY, Buffer.from(ivB, 'base64'))
	decipher.setAuthTag(Buffer.from(tagB, 'base64'))
	return Buffer.concat([decipher.update(Buffer.from(dataB, 'base64')), decipher.final()]).toString(
		'utf8'
	)
}
