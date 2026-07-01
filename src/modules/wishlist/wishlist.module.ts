import { Module } from '@nestjs/common'
import { WishlistController } from './wishlist.controller'
import { WishlistAdminController } from './wishlist-admin.controller'
import { WishlistService } from './wishlist.service'

@Module({
	controllers: [WishlistController, WishlistAdminController],
	providers: [WishlistService]
})
export class WishlistModule {}
