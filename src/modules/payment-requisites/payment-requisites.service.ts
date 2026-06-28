import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PaymentRequisite, Prisma } from '@prisma/client'
import { PrismaService } from 'src/database/prisma/prisma.service'
import { decryptSecret, encryptSecret } from 'src/common/utils/crypto.util'
import { CreatePaymentRequisiteDto } from './dto/create-payment-requisite.dto'
import { UpdatePaymentRequisiteDto } from './dto/update-payment-requisite.dto'

@Injectable()
export class PaymentRequisitesService {
	constructor(private readonly prisma: PrismaService) {}

	async findAll() {
		const items = await this.prisma.paymentRequisite.findMany({ orderBy: { id: 'asc' } })
		return items.map(i => this.toSafe(i))
	}

	async create(dto: CreatePaymentRequisiteDto) {
		const privateKeySet = !!dto.liqpayPrivateKey?.trim()

		// Канал авто-активується, якщо він повний і ще немає активного по цьому каналу.
		const [activeIban, activeLiqpay] = await Promise.all([
			this.prisma.paymentRequisite.count({ where: { ibanActive: true } }),
			this.prisma.paymentRequisite.count({ where: { liqpayActive: true } })
		])
		const ibanActive = this.ibanComplete(dto) && activeIban === 0
		const liqpayActive = this.liqpayComplete(dto, privateKeySet) && activeLiqpay === 0

		const created = await this.prisma.paymentRequisite.create({
			data: {
				label: dto.label.trim(),
				taxId: dto.taxId?.trim() || null,
				iban: dto.iban?.trim() || null,
				bankName: dto.bankName?.trim() || null,
				liqpayPublicKey: dto.liqpayPublicKey?.trim() || null,
				liqpayPrivateKey: privateKeySet ? encryptSecret(dto.liqpayPrivateKey!.trim()) : null,
				ibanActive,
				liqpayActive
			}
		})
		return this.toSafe(created)
	}

	async update(id: bigint, dto: UpdatePaymentRequisiteDto) {
		const existing = await this.prisma.paymentRequisite.findUnique({ where: { id } })
		if (!existing) throw new NotFoundException('Реквізити не знайдено')

		// ефективні значення після оновлення
		const eff = {
			label: dto.label ?? existing.label,
			taxId: dto.taxId !== undefined ? dto.taxId : existing.taxId,
			iban: dto.iban !== undefined ? dto.iban : existing.iban,
			bankName: dto.bankName !== undefined ? dto.bankName : existing.bankName,
			liqpayPublicKey:
				dto.liqpayPublicKey !== undefined ? dto.liqpayPublicKey : existing.liqpayPublicKey
		}
		const privateKeySet = dto.liqpayPrivateKey?.trim() ? true : !!existing.liqpayPrivateKey
		const ibanCompleteNow = this.ibanComplete(eff)
		const liqpayCompleteNow = this.liqpayComplete(eff, privateKeySet)

		// явна активація (кнопки) має проходити валідацію повноти
		if (dto.ibanActive) this.assertIbanComplete(eff)
		if (dto.liqpayActive) this.assertLiqpayComplete(eff, privateKeySet)

		// фінальний стан каналів: явний прапорець, інакше — авто-активація,
		// якщо канал став повним і ще немає активного по цьому каналу
		let ibanActive = dto.ibanActive ?? existing.ibanActive
		let liqpayActive = dto.liqpayActive ?? existing.liqpayActive

		if (dto.ibanActive === undefined && !existing.ibanActive && ibanCompleteNow) {
			const others = await this.prisma.paymentRequisite.count({
				where: { ibanActive: true, id: { not: id } }
			})
			if (others === 0) ibanActive = true
		}
		if (dto.liqpayActive === undefined && !existing.liqpayActive && liqpayCompleteNow) {
			const others = await this.prisma.paymentRequisite.count({
				where: { liqpayActive: true, id: { not: id } }
			})
			if (others === 0) liqpayActive = true
		}

		const updated = await this.prisma.$transaction(async tx => {
			// активним по каналу лише один
			if (ibanActive) {
				await tx.paymentRequisite.updateMany({ where: { id: { not: id } }, data: { ibanActive: false } })
			}
			if (liqpayActive) {
				await tx.paymentRequisite.updateMany({
					where: { id: { not: id } },
					data: { liqpayActive: false }
				})
			}

			const data: Prisma.PaymentRequisiteUpdateInput = {}
			if (dto.label !== undefined) data.label = dto.label.trim()
			if (dto.taxId !== undefined) data.taxId = dto.taxId?.trim() || null
			if (dto.iban !== undefined) data.iban = dto.iban?.trim() || null
			if (dto.bankName !== undefined) data.bankName = dto.bankName?.trim() || null
			if (dto.liqpayPublicKey !== undefined) data.liqpayPublicKey = dto.liqpayPublicKey?.trim() || null
			data.ibanActive = ibanActive
			data.liqpayActive = liqpayActive
			// приватний ключ оновлюємо лише якщо передано непорожнє значення (write-only)
			if (dto.liqpayPrivateKey?.trim()) {
				data.liqpayPrivateKey = encryptSecret(dto.liqpayPrivateKey.trim())
			}

			return tx.paymentRequisite.update({ where: { id }, data })
		})
		return this.toSafe(updated)
	}

	async remove(id: bigint) {
		await this.ensureExists(id)
		await this.prisma.paymentRequisite.delete({ where: { id } })
		return { ok: true }
	}

	// Активні реквізити для прийому коштів (внутрішнє, не через контролер):
	async getActiveIban() {
		return this.prisma.paymentRequisite.findFirst({ where: { ibanActive: true } })
	}

	async getActiveLiqpayWithSecret() {
		const r = await this.prisma.paymentRequisite.findFirst({ where: { liqpayActive: true } })
		if (!r) return null
		return {
			...r,
			liqpayPrivateKey: r.liqpayPrivateKey ? decryptSecret(r.liqpayPrivateKey) : null
		}
	}

	// Повнота каналів (булеві)
	private ibanComplete(f: {
		label?: string | null
		taxId?: string | null
		iban?: string | null
		bankName?: string | null
	}) {
		return !!(f.label?.trim() && f.taxId?.trim() && f.iban?.trim() && f.bankName?.trim())
	}

	private liqpayComplete(f: { liqpayPublicKey?: string | null }, privateKeySet: boolean) {
		return !!f.liqpayPublicKey?.trim() && privateKeySet
	}

	// Активувати канал можна лише коли він повністю заповнений
	private assertIbanComplete(f: {
		label?: string | null
		taxId?: string | null
		iban?: string | null
		bankName?: string | null
	}) {
		if (this.ibanComplete(f)) return
		const missing: string[] = []
		if (!f.label?.trim()) missing.push('ПІБ отримувача')
		if (!f.taxId?.trim()) missing.push('ІПН/ЄДРПОУ')
		if (!f.iban?.trim()) missing.push('IBAN')
		if (!f.bankName?.trim()) missing.push('Банк')
		throw new BadRequestException(`Не можна активувати IBAN — заповніть: ${missing.join(', ')}`)
	}

	private assertLiqpayComplete(f: { liqpayPublicKey?: string | null }, privateKeySet: boolean) {
		if (this.liqpayComplete(f, privateKeySet)) return
		const missing: string[] = []
		if (!f.liqpayPublicKey?.trim()) missing.push('LiqPay public key')
		if (!privateKeySet) missing.push('LiqPay private key')
		throw new BadRequestException(`Не можна активувати LiqPay — заповніть: ${missing.join(', ')}`)
	}

	private async ensureExists(id: bigint) {
		const r = await this.prisma.paymentRequisite.findUnique({ where: { id }, select: { id: true } })
		if (!r) throw new NotFoundException('Реквізити не знайдено')
	}

	// Назовні ніколи не віддаємо приватний ключ — лише прапорець «заданий».
	private toSafe(r: PaymentRequisite) {
		const { liqpayPrivateKey, ...rest } = r
		return { ...rest, liqpayPrivateKeySet: !!liqpayPrivateKey }
	}
}
