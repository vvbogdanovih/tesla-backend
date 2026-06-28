import { Injectable, Logger } from '@nestjs/common'
import { S3Client, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { ENV } from 'src/common/constants'

const PRESIGN_EXPIRES_IN = 900 // 15 хв
const MAX_DIMENSION = 1600 // макс. сторона після ресайзу, px
const AVIF_QUALITY = 55 // 0–100; ~55 — гарний баланс розмір/якість для фото
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable' // імена з UUID → вічний кеш

@Injectable()
export class S3Service {
	private readonly logger = new Logger(S3Service.name)
	private readonly s3: S3Client
	private readonly bucket = ENV.AWS_S3_BUCKET_NAME

	constructor() {
		this.s3 = new S3Client({
			region: ENV.AWS_REGION,
			// endpoint → R2 / інше S3-сумісне; без endpoint → AWS S3
			...(ENV.AWS_S3_ENDPOINT ? { endpoint: ENV.AWS_S3_ENDPOINT } : {}),
			forcePathStyle: ENV.AWS_S3_FORCE_PATH_STYLE,
			// credentials лише якщо задані (інакше — default chain / IAM role на AWS)
			...(ENV.AWS_ACCESS_KEY_ID && ENV.AWS_SECRET_ACCESS_KEY
				? {
						credentials: {
							accessKeyId: ENV.AWS_ACCESS_KEY_ID,
							secretAccessKey: ENV.AWS_SECRET_ACCESS_KEY
						}
					}
				: {}),
			// без авто-checksums, щоб presigned PUT працював із браузера (CORS)
			requestChecksumCalculation: 'WHEN_REQUIRED',
			responseChecksumValidation: 'WHEN_REQUIRED'
		})
	}

	/** Presigned URL для прямого завантаження з браузера. */
	async presignUpload(contentType: string, prefix = 'products') {
		const ext = contentType.split('/')[1] ?? 'bin'
		const key = `${prefix}/${randomUUID()}.${ext}`
		const uploadUrl = await getSignedUrl(
			this.s3,
			new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
			{ expiresIn: PRESIGN_EXPIRES_IN }
		)
		return { key, uploadUrl, publicUrl: this.publicUrl(key) }
	}

	/**
	 * Конвертує зображення у **AVIF** (авто-орієнтація за EXIF + ресайз до
	 * MAX_DIMENSION, без збільшення), вантажить у R2/S3 і повертає публічний URL.
	 * Завантаження проксується через бекенд (адмінські, нечасті) — тому presign тут не потрібен.
	 */
	async uploadImage(buffer: Buffer, prefix = 'products') {
		const processed = await sharp(buffer, { failOn: 'none' })
			.rotate() // застосувати EXIF-орієнтацію, далі метадані відкидаються
			.resize({
				width: MAX_DIMENSION,
				height: MAX_DIMENSION,
				fit: 'inside',
				withoutEnlargement: true
			})
			.avif({ quality: AVIF_QUALITY, effort: 4 })
			.toBuffer()

		const key = `${this.safePrefix(prefix)}/${randomUUID()}.avif`
		await this.s3.send(
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: key,
				Body: processed,
				ContentType: 'image/avif',
				CacheControl: IMMUTABLE_CACHE
			})
		)
		this.logger.log(`Завантажено AVIF: ${key} (${processed.byteLength} B)`)
		return { key, url: this.publicUrl(key) }
	}

	// лишаємо тільки безпечні сегменти шляху (літери/цифри/-/_)
	private safePrefix(prefix: string): string {
		const clean = prefix.replace(/[^a-z0-9/_-]/gi, '').replace(/^\/+|\/+$/g, '')
		return clean || 'products'
	}

	publicUrl(key: string): string {
		if (ENV.AWS_S3_PUBLIC_URL) return `${ENV.AWS_S3_PUBLIC_URL}/${key}`
		if (ENV.AWS_S3_ENDPOINT) return `${ENV.AWS_S3_ENDPOINT}/${this.bucket}/${key}` // S3-сумісне
		return `https://${this.bucket}.s3.${ENV.AWS_REGION}.amazonaws.com/${key}`
	}

	async deleteFile(key: string) {
		await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
	}
}
