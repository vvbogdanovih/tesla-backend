import { Module } from '@nestjs/common'
import { PaymentRequisitesController } from './payment-requisites.controller'
import { PaymentRequisitesService } from './payment-requisites.service'

@Module({
	controllers: [PaymentRequisitesController],
	providers: [PaymentRequisitesService],
	exports: [PaymentRequisitesService]
})
export class PaymentRequisitesModule {}
