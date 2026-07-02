import { Module } from '@nestjs/common'
import { PaymentRequisitesController } from './payment-requisites.controller'
import { PaymentRequisitesPublicController } from './payment-requisites-public.controller'
import { PaymentRequisitesService } from './payment-requisites.service'

@Module({
	controllers: [PaymentRequisitesController, PaymentRequisitesPublicController],
	providers: [PaymentRequisitesService],
	exports: [PaymentRequisitesService]
})
export class PaymentRequisitesModule {}
