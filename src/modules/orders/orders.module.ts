import { Module } from '@nestjs/common'
import { OrdersController } from './orders.controller'
import { AccountOrdersController } from './account-orders.controller'
import { OrdersService } from './orders.service'

@Module({
	controllers: [OrdersController, AccountOrdersController],
	providers: [OrdersService],
	exports: [OrdersService]
})
export class OrdersModule {}
