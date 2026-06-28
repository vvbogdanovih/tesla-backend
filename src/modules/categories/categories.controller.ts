import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard'
import { RolesGuard } from 'src/common/guards/roles.guard'
import { Roles } from 'src/common/decorators/roles.decorator'
import { CategoriesService } from './categories.service'
import { CreateCategoryDto } from './dto/create-category.dto'
import { UpdateCategoryDto } from './dto/update-category.dto'

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
	constructor(private readonly categories: CategoriesService) {}

	// Публічно — таксономія для каталогу/меню
	@Get()
	findAll() {
		return this.categories.findAll()
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('admin', 'superadmin')
	@Post()
	create(@Body() dto: CreateCategoryDto) {
		return this.categories.create(dto)
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('admin', 'superadmin')
	@Patch(':id')
	update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
		return this.categories.update(BigInt(id), dto)
	}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('admin', 'superadmin')
	@Delete(':id')
	remove(@Param('id') id: string) {
		return this.categories.remove(BigInt(id))
	}
}
