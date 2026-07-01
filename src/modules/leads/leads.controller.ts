import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { LeadStatus } from '@prisma/client'
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard'
import { RolesGuard } from 'src/common/guards/roles.guard'
import { Roles } from 'src/common/decorators/roles.decorator'
import { LeadsService } from './leads.service'
import { CreateLeadDto } from './dto/create-lead.dto'
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto'

@ApiTags('leads')
@Controller('leads')
export class LeadsController {
	constructor(private readonly leads: LeadsService) {}

	// Публічно — будь-яка форма зі сторфронту
	@Post()
	create(@Body() dto: CreateLeadDto) {
		return this.leads.create(dto)
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('admin', 'superadmin')
	@Get()
	findAll(@Query('status') status?: LeadStatus) {
		return this.leads.findAll(status)
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('admin', 'superadmin')
	@Patch(':id')
	setStatus(@Param('id') id: string, @Body() dto: UpdateLeadStatusDto) {
		return this.leads.setStatus(BigInt(id), dto.status)
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('admin', 'superadmin')
	@Delete(':id')
	remove(@Param('id') id: string) {
		return this.leads.remove(BigInt(id))
	}
}
