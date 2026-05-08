import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import { RequirePermissions } from "../auth/require-permission.decorator";
import { SystemHealthService } from "./system-health.service";

@Controller("system-health")
export class SystemHealthController {
  constructor(private readonly service: SystemHealthService) {}

  @Get()
  @Public()
  getHealth() {
    return this.service.getPublicHealth();
  }

  @Get("details")
  @RequirePermissions("system_health.view")
  getHealthDetails() {
    return this.service.getProtectedHealthDetails();
  }
}
