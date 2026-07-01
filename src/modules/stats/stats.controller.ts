import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard'
import { RolesGuard } from 'src/common/guards/roles.guard'
import { Roles } from 'src/common/decorators/roles.decorator'
import { StatsService } from './stats.service'

@ApiTags('admin')
@Controller('admin')
export class StatsController {
	constructor(private readonly stats: StatsService) {}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('admin', 'superadmin')
	@Get('stats')
	dashboard() {
		return this.stats.dashboard()
	}
}
