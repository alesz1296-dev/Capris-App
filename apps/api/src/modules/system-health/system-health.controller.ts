import { Controller, Get, Res } from "@nestjs/common";
import type { Response } from "express";
import { Public } from "../auth/public.decorator";
import { RequirePermissions } from "../auth/require-permission.decorator";
import { SystemHealthService } from "./system-health.service";

@Controller("system-health")
export class SystemHealthController {
  constructor(private readonly service: SystemHealthService) {}

  @Get()
  @Public()
  getHealth() {
    return this.service.getLiveness();
  }

  @Get("liveness")
  @Public()
  getLiveness() {
    return this.service.getLiveness();
  }

  @Get("readiness")
  @Public()
  async getReadiness(@Res({ passthrough: true }) response: Response) {
    const readiness = await this.service.getReadiness();
    if (readiness.status !== "ok") {
      response.status(503);
    }

    return readiness;
  }

  @Get("details")
  @RequirePermissions("system_health.view")
  getHealthDetails() {
    return this.service.getProtectedHealthDetails();
  }
}
