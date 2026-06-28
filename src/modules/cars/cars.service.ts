import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from 'src/database/prisma/prisma.service'
import { slugify } from 'src/common/utils/slugify'
import { CreateCarDto } from './dto/create-car.dto'
import { UpdateCarDto } from './dto/update-car.dto'

@Injectable()
export class CarsService {
	constructor(private readonly prisma: PrismaService) {}

	// Публічний список — для фільтра сумісності на сторфронті (із кількістю товарів)
	findAll() {
		return this.prisma.car.findMany({
			orderBy: [{ model: 'asc' }, { generation: 'asc' }],
			include: { _count: { select: { fitment: true } } }
		})
	}

	async create(dto: CreateCarDto) {
		try {
			return await this.prisma.car.create({
				data: {
					brand: dto.brand?.trim() || 'Tesla',
					model: dto.model.trim(),
					generation: dto.generation?.trim() || null,
					slug: this.resolveSlug(dto.slug, dto.model, dto.generation),
					imageUrl: dto.imageUrl?.trim() || null,
					productionStart: new Date(dto.productionStart),
					productionEnd: this.toDate(dto.productionEnd)
				}
			})
		} catch (e) {
			throw this.mapError(e)
		}
	}

	async update(id: bigint, dto: UpdateCarDto) {
		await this.ensureExists(id)

		const data: Prisma.CarUpdateInput = {}
		if (dto.brand !== undefined) data.brand = dto.brand.trim() || 'Tesla'
		if (dto.model !== undefined) data.model = dto.model.trim()
		if (dto.generation !== undefined) data.generation = dto.generation?.trim() || null
		if (dto.slug !== undefined) data.slug = slugify(dto.slug)
		if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl?.trim() || null
		if (dto.productionStart) data.productionStart = new Date(dto.productionStart)
		if (dto.productionEnd !== undefined) data.productionEnd = this.toDate(dto.productionEnd)

		try {
			return await this.prisma.car.update({ where: { id }, data })
		} catch (e) {
			throw this.mapError(e)
		}
	}

	async remove(id: bigint) {
		await this.ensureExists(id)

		// Видалення авто каскадно прибере звʼязки сумісності з товарів — блокуємо, поки вони є
		const linked = await this.prisma.productFitment.count({ where: { carId: id } })
		if (linked > 0) {
			throw new ConflictException(
				`Неможливо видалити: до авто прив'язано товарів — ${linked}. Спершу відвʼяжіть їх.`
			)
		}

		await this.prisma.car.delete({ where: { id } })
		return { ok: true }
	}

	private async ensureExists(id: bigint) {
		const car = await this.prisma.car.findUnique({ where: { id } })
		if (!car) throw new NotFoundException('Авто не знайдено')
	}

	private resolveSlug(slug: string | undefined, model: string, generation?: string) {
		if (slug?.trim()) return slugify(slug)
		return slugify([model, generation].filter(Boolean).join(' '))
	}

	private toDate(value?: string): Date | null {
		return value ? new Date(value) : null
	}

	private mapError(e: unknown) {
		if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
			return new ConflictException('Авто з таким slug вже існує')
		}
		return e
	}
}
