import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { CatalogService } from './catalog.service'
import { CatalogQueryDto } from './dto/catalog-query.dto'

// Публічний каталог (сторфронт) — без авторизації, лише активні товари.
@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
	constructor(private readonly catalog: CatalogService) {}

	@Get('products')
	list(@Query() query: CatalogQueryDto) {
		return this.catalog.list(query)
	}

	@Get('search')
	search(@Query('q') q = '', @Query('limit') limit?: string) {
		return this.catalog.search(q, limit ? Number(limit) : 8)
	}

	@Get('products/:slug')
	bySlug(@Param('slug') slug: string) {
		return this.catalog.bySlug(slug)
	}
}
