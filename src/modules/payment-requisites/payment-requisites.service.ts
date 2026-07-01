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
		const liqpayKeySet = !!dto.liqpayPrivateKey?.trim()
		const monopayTokenSet = !!dto.monopayToken?.trim()

		// Канал авто-активується, якщо він повний і ще немає активного по цьому каналу.
		const [activeIban, activeLiqpay, activeMonopay] = await Promise.all([
			this.prisma.paymentRequisite.count({ where: { ibanActive: true } }),
			this.prisma.paymentRequisite.count({ where: { liqpayActive: true } }),
			this.prisma.paymentRequisite.count({ where: { monopayActive: true } })
		])

		const created = await this.prisma.paymentRequisite.create({
			data: {
				label: dto.label.trim(),
				taxId: dto.taxId?.trim() || null,
				iban: dto.iban?.trim() || null,
				bankName: dto.bankName?.trim() || null,
				liqpayPublicKey: dto.liqpayPublicKey?.trim() || null,
				liqpayPrivateKey: liqpayKeySet ? encryptSecret(dto.liqpayPrivateKey!.trim()) : null,
				monopayToken: monopayTokenSet ? encryptSecret(dto.monopayToken!.trim()) : null,
				ibanActive: this.ibanComplete(dto) && activeIban === 0,
				liqpayActive: this.liqpayComplete(dto, liqpayKeySet) && activeLiqpay === 0,
				monopayActive: monopayTokenSet && activeMonopay === 0
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
		const liqpayKeySet = dto.liqpayPrivateKey?.trim() ? true : !!existing.liqpayPrivateKey
		const monopayTokenSet = dto.monopayToken?.trim() ? true : !!existing.monopayToken

		// явна активація (кнопки) має проходити валідацію повноти
		if (dto.ibanActive) this.assertIbanComplete(eff)
		if (dto.liqpayActive) this.assertLiqpayComplete(eff, liqpayKeySet)
		if (dto.monopayActive) this.assertMonopayComplete(monopayTokenSet)

		// фінальний стан каналів: явний прапорець, інакше — авто-активація,
		// якщо канал став повним і ще немає активного по цьому каналу
		const ibanActive = await this.resolveActive(
			'ibanActive',
			dto.ibanActive,
			existing.ibanActive,
			this.ibanComplete(eff),
			id
		)
		const liqpayActive = await this.resolveActive(
			'liqpayActive',
			dto.liqpayActive,
			existing.liqpayActive,
			this.liqpayComplete(eff, liqpayKeySet),
			id
		)
		const monopayActive = await this.resolveActive(
			'monopayActive',
			dto.monopayActive,
			existing.monopayActive,
			monopayTokenSet,
			id
		)

		const updated = await this.prisma.$transaction(async tx => {
			// активним по каналу лише один
			if (ibanActive) await tx.paymentRequisite.updateMany({ where: { id: { not: id } }, data: { ibanActive: false } })
			if (liqpayActive) await tx.paymentRequisite.updateMany({ where: { id: { not: id } }, data: { liqpayActive: false } })
			if (monopayActive) await tx.paymentRequisite.updateMany({ where: { id: { not: id } }, data: { monopayActive: false } })

			const data: Prisma.PaymentRequisiteUpdateInput = {}
			if (dto.label !== undefined) data.label = dto.label.trim()
			if (dto.taxId !== undefined) data.taxId = dto.taxId?.trim() || null
			if (dto.iban !== undefined) data.iban = dto.iban?.trim() || null
			if (dto.bankName !== undefined) data.bankName = dto.bankName?.trim() || null
			if (dto.liqpayPublicKey !== undefined) data.liqpayPublicKey = dto.liqpayPublicKey?.trim() || null
			data.ibanActive = ibanActive
			data.liqpayActive = liqpayActive
			data.monopayActive = monopayActive
			// секрети оновлюємо лише якщо передано непорожнє значення (write-only)
			if (dto.liqpayPrivateKey?.trim()) data.liqpayPrivateKey = encryptSecret(dto.liqpayPrivateKey.trim())
			if (dto.monopayToken?.trim()) data.monopayToken = encryptSecret(dto.monopayToken.trim())

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
		return { ...r, liqpayPrivateKey: r.liqpayPrivateKey ? decryptSecret(r.liqpayPrivateKey) : null }
	}

	async getActiveMonopayWithSecret() {
		const r = await this.prisma.paymentRequisite.findFirst({ where: { monopayActive: true } })
		if (!r) return null
		return { ...r, monopayToken: r.monopayToken ? decryptSecret(r.monopayToken) : null }
	}

	// Фінальний стан каналу: явний прапорець; інакше авто-активація, якщо став повним і нікого активного
	private async resolveActive(
		field: 'ibanActive' | 'liqpayActive' | 'monopayActive',
		explicit: boolean | undefined,
		wasActive: boolean,
		complete: boolean,
		id: bigint
	): Promise<boolean> {
		if (explicit !== undefined) return explicit
		if (!wasActive && complete) {
			const others = await this.prisma.paymentRequisite.count({
				where: { [field]: true, id: { not: id } }
			})
			if (others === 0) return true
		}
		return wasActive
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

	private liqpayComplete(f: { liqpayPublicKey?: string | null }, keySet: boolean) {
		return !!f.liqpayPublicKey?.trim() && keySet
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

	private assertLiqpayComplete(f: { liqpayPublicKey?: string | null }, keySet: boolean) {
		if (this.liqpayComplete(f, keySet)) return
		const missing: string[] = []
		if (!f.liqpayPublicKey?.trim()) missing.push('LiqPay public key')
		if (!keySet) missing.push('LiqPay private key')
		throw new BadRequestException(`Не можна активувати LiqPay — заповніть: ${missing.join(', ')}`)
	}

	private assertMonopayComplete(tokenSet: boolean) {
		if (tokenSet) return
		throw new BadRequestException('Не можна активувати Monopay — вкажіть токен')
	}

	private async ensureExists(id: bigint) {
		const r = await this.prisma.paymentRequisite.findUnique({ where: { id }, select: { id: true } })
		if (!r) throw new NotFoundException('Реквізити не знайдено')
	}

	// Назовні ніколи не віддаємо секрети — лише прапорці «задано».
	private toSafe(r: PaymentRequisite) {
		const { liqpayPrivateKey, monopayToken, ...rest } = r
		return {
			...rest,
			liqpayPrivateKeySet: !!liqpayPrivateKey,
			monopayTokenSet: !!monopayToken
		}
	}
}
