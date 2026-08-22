import { Controller, ForbiddenException, Get, Headers, Res } from "@nestjs/common";
import type { Response } from "express";
import { Public } from "../auth/public.decorator";
import { RequestMetricsService } from "./request-metrics.service";

@Controller()
export class MetricsController {
  constructor(private readonly requestMetrics: RequestMetricsService) {}

  @Get("metrics")
  @Public()
  getMetrics(
    @Headers("authorization") authorization: string | undefined,
    @Res({ passthrough: true }) response: Response
  ) {
    assertMetricsAccess(authorization);
    response.type("text/plain; version=0.0.4; charset=utf-8");
    return this.requestMetrics.renderPrometheusMetrics();
  }
}

function assertMetricsAccess(authorization: string | undefined) {
  const configuredToken = process.env.METRICS_BEARER_TOKEN?.trim();
  if (!configuredToken) {
    return;
  }

  const expectedHeader = `Bearer ${configuredToken}`;
  if (authorization?.trim() !== expectedHeader) {
    throw new ForbiddenException("Metrics bearer token is required.");
  }
}
