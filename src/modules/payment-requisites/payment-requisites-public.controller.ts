import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { PaymentRequisitesService } from './payment-requisites.service'

// Публічні реквізити для оплати за рахунком (IBAN) — без секретів (ADR-0008)
@ApiTags('payment-requisites')
@Controller('payment-requisites')
export class PaymentRequisitesPublicController {
	constructor(private readonly requisites: PaymentRequisitesService) {}

	// Активний канал IBAN для чекаута/сторінки оплати
	@Get('active')
	active() {
		return this.requisites.getActivePublic()
	}
}
