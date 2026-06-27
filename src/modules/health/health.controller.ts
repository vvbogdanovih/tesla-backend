import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ENDPOINTS } from 'src/common/constants'

@ApiTags('health')
@Controller(ENDPOINTS.HEALTH.BASE)
export class HealthController {
	@Get()
	check() {
		return { status: 'ok', service: 'tesla-backend', ts: new Date().toISOString() }
	}
}
