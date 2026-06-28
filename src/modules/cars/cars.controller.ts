import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard'
import { RolesGuard } from 'src/common/guards/roles.guard'
import { Roles } from 'src/common/decorators/roles.decorator'
import { CarsService } from './cars.service'
import { CreateCarDto } from './dto/create-car.dto'
import { UpdateCarDto } from './dto/update-car.dto'

@ApiTags('cars')
@Controller('cars')
export class CarsController {
	constructor(private readonly cars: CarsService) {}

	// Публічно — потрібно для фільтра сумісності
	@Get()
	findAll() {
		return this.cars.findAll()
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('admin', 'superadmin')
	@Post()
	create(@Body() dto: CreateCarDto) {
		return this.cars.create(dto)
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('admin', 'superadmin')
	@Patch(':id')
	update(@Param('id') id: string, @Body() dto: UpdateCarDto) {
		return this.cars.update(BigInt(id), dto)
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('admin', 'superadmin')
	@Delete(':id')
	remove(@Param('id') id: string) {
		return this.cars.remove(BigInt(id))
	}
}
