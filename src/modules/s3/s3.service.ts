import { Injectable, Logger } from '@nestjs/common'
import { S3Client, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'node:crypto'
import { ENV } from 'src/common/constants'

const PRESIGN_EXPIRES_IN = 900 // 15 хв

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

	publicUrl(key: string): string {
		if (ENV.AWS_S3_PUBLIC_URL) return `${ENV.AWS_S3_PUBLIC_URL}/${key}`
		if (ENV.AWS_S3_ENDPOINT) return `${ENV.AWS_S3_ENDPOINT}/${this.bucket}/${key}` // S3-сумісне
		return `https://${this.bucket}.s3.${ENV.AWS_REGION}.amazonaws.com/${key}`
	}

	async deleteFile(key: string) {
		await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
	}
}
