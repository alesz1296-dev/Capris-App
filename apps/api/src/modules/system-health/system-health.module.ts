import { Module } from "@nestjs/common";
import { MetricsController } from "./metrics.controller";
import { RequestMetricsService } from "./request-metrics.service";
import { SystemHealthController } from "./system-health.controller";
import { SystemHealthService } from "./system-health.service";

@Module({
  controllers: [SystemHealthController, MetricsController],
  providers: [SystemHealthService, RequestMetricsService],
  exports: [RequestMetricsService]
})
export class SystemHealthModule {}
