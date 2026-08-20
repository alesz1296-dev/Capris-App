import { Injectable } from "@nestjs/common";
import type { Request } from "express";

type RequestMetricRecord = {
  count: number;
  durationMsSum: number;
};

type RecordRequestInput = {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
};

@Injectable()
export class RequestMetricsService {
  private readonly processStartedAt = Date.now();
  private readonly requestTotals = new Map<string, number>();
  private readonly requestDurations = new Map<string, RequestMetricRecord>();

  recordRequest(input: RecordRequestInput) {
    const method = normalizeLabel(input.method.toUpperCase());
    const route = normalizeLabel(input.route);
    const statusCode = normalizeLabel(String(input.statusCode));
    const requestTotalKey = joinKey(method, route, statusCode);
    const durationKey = joinKey(method, route);
    const existingDuration = this.requestDurations.get(durationKey) ?? {
      count: 0,
      durationMsSum: 0
    };

    this.requestTotals.set(requestTotalKey, (this.requestTotals.get(requestTotalKey) ?? 0) + 1);
    this.requestDurations.set(durationKey, {
      count: existingDuration.count + 1,
      durationMsSum: existingDuration.durationMsSum + Math.max(0, input.durationMs)
    });
  }

  renderPrometheusMetrics() {
    const lines: string[] = [
      "# HELP capris_process_uptime_seconds Process uptime in seconds.",
      "# TYPE capris_process_uptime_seconds gauge",
      `capris_process_uptime_seconds ${((Date.now() - this.processStartedAt) / 1000).toFixed(3)}`,
      "# HELP capris_build_info Static build and deployment metadata.",
      "# TYPE capris_build_info gauge",
      `capris_build_info{version="${escapeLabel(process.env.npm_package_version ?? "0.1.0")}",deployment_id="${escapeLabel(
        process.env.CAPRIS_DEPLOYMENT_ID?.trim() ||
          process.env.RAILWAY_DEPLOYMENT_ID?.trim() ||
          process.env.RAILWAY_GIT_COMMIT_SHA?.trim()?.slice(0, 7) ||
          "local"
      )}",environment="${escapeLabel(process.env.NODE_ENV ?? "development")}"} 1`,
      "# HELP capris_http_requests_total Total HTTP requests handled by method, route, and status code.",
      "# TYPE capris_http_requests_total counter"
    ];

    for (const [key, total] of [...this.requestTotals.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      const [method, route, statusCode] = splitKey(key, 3);
      lines.push(
        `capris_http_requests_total{method="${escapeLabel(method)}",route="${escapeLabel(route)}",status_code="${escapeLabel(statusCode)}"} ${total}`
      );
    }

    lines.push("# HELP capris_http_request_duration_ms_sum Total request duration in milliseconds by method and route.");
    lines.push("# TYPE capris_http_request_duration_ms_sum counter");
    lines.push("# HELP capris_http_request_duration_ms_count Request count used for duration aggregation by method and route.");
    lines.push("# TYPE capris_http_request_duration_ms_count counter");

    for (const [key, record] of [...this.requestDurations.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      const [method, route] = splitKey(key, 2);
      lines.push(
        `capris_http_request_duration_ms_sum{method="${escapeLabel(method)}",route="${escapeLabel(route)}"} ${record.durationMsSum.toFixed(3)}`
      );
      lines.push(
        `capris_http_request_duration_ms_count{method="${escapeLabel(method)}",route="${escapeLabel(route)}"} ${record.count}`
      );
    }

    return `${lines.join("\n")}\n`;
  }
}

export function resolveRequestRouteLabel(request: Request) {
  const routePath =
    typeof request.route?.path === "string"
      ? request.route.path
      : request.originalUrl.split("?")[0] || request.url.split("?")[0] || "/";
  const route = `${request.baseUrl ?? ""}${routePath}`.replace(/\/+/g, "/");
  return route.startsWith("/") ? route : `/${route}`;
}

function joinKey(...parts: string[]) {
  return parts.join("::");
}

function splitKey(value: string, expectedParts: number) {
  const parts = value.split("::");
  while (parts.length < expectedParts) {
    parts.push("");
  }
  return parts;
}

function normalizeLabel(value: string) {
  return value.trim() || "unknown";
}

function escapeLabel(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}
