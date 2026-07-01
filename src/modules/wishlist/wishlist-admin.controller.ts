import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard'
import { RolesGuard } from 'src/common/guards/roles.guard'
import { Roles } from 'src/common/decorators/roles.decorator'
import { WishlistService } from './wishlist.service'
import { WishlistAdminQueryDto } from './dto/wishlist-admin-query.dto'

// Адмін-огляд «Обране (лайки)» — сигнал інтересу для обдзвону зацікавлених (ADR-0012)
@ApiTags('wishlist-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'superadmin')
@Controller('admin/wishlist')
export class WishlistAdminController {
	constructor(private readonly wishlist: WishlistService) {}

	// Хто що додав в обране (клієнт+контакт+товар+дата) + «найбажаніші товари»
	@Get()
	list(@Query() q: WishlistAdminQueryDto) {
		return this.wishlist.adminList(q)
	}
}
