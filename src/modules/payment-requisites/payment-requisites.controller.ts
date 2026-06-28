import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard'
import { RolesGuard } from 'src/common/guards/roles.guard'
import { Roles } from 'src/common/decorators/roles.decorator'
import { PaymentRequisitesService } from './payment-requisites.service'
import { CreatePaymentRequisiteDto } from './dto/create-payment-requisite.dto'
import { UpdatePaymentRequisiteDto } from './dto/update-payment-requisite.dto'

// Чутливі дані — лише superadmin.
@ApiTags('payment-requisites')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin')
@Controller('payment-requisites')
export class PaymentRequisitesController {
	constructor(private readonly requisites: PaymentRequisitesService) {}

	@Get()
	findAll() {
		return this.requisites.findAll()
	}

	@Post()
	create(@Body() dto: CreatePaymentRequisiteDto) {
		return this.requisites.create(dto)
	}

	@Patch(':id')
	update(@Param('id') id: string, @Body() dto: UpdatePaymentRequisiteDto) {
		return this.requisites.update(BigInt(id), dto)
	}

	@Delete(':id')
	remove(@Param('id') id: string) {
		return this.requisites.remove(BigInt(id))
	}
}
