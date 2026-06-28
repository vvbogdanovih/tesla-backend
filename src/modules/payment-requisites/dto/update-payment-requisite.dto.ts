import { PartialType } from '@nestjs/swagger'
import { CreatePaymentRequisiteDto } from './create-payment-requisite.dto'

export class UpdatePaymentRequisiteDto extends PartialType(CreatePaymentRequisiteDto) {}
