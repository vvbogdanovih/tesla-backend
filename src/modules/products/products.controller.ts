import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard'
import { RolesGuard } from 'src/common/guards/roles.guard'
import { Roles } from 'src/common/decorators/roles.decorator'
import { ProductsService } from './products.service'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'

// Адмін-CRUD. Публічний каталог (фільтри/пошук/by-slug) — окремим кроком.
@ApiTags('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'superadmin')
@Controller('products')
export class ProductsController {
	constructor(private readonly products: ProductsService) {}

	@Get()
	findAll() {
		return this.products.findAll()
	}

	@Get(':id')
	findOne(@Param('id') id: string) {
		return this.products.findOne(BigInt(id))
	}

	@Post()
	create(@Body() dto: CreateProductDto) {
		return this.products.create(dto)
	}

	@Patch(':id')
	update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
		return this.products.update(BigInt(id), dto)
	}

	@Delete(':id')
	remove(@Param('id') id: string) {
		return this.products.remove(BigInt(id))
	}
}
