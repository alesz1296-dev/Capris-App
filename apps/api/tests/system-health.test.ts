import "reflect-metadata";
import assert from "node:assert/strict";
import { RequestMetricsService } from "../src/modules/system-health/request-metrics.service";
import { SystemHealthService } from "../src/modules/system-health/system-health.service";

async function testLiveness() {
  const service = new SystemHealthService({} as never);
  const liveness = service.getLiveness();

  assert.equal(liveness.status, "ok");
  assert.equal(liveness.checks.api, "ok");
  assert.equal(liveness.checks.process, "ok");
}

async function testReadinessWhenDatabaseIsReachable() {
  const service = new SystemHealthService(
    {
      $queryRawUnsafe: async () => [{ "?column?": 1 }]
    } as never
  );

  const readiness = await service.getReadiness();
  assert.equal(readiness.status, "ok");
  assert.equal(readiness.checks.database, "ok");
}

async function testReadinessWhenDatabaseIsUnavailable() {
  const service = new SystemHealthService(
    {
      $queryRawUnsafe: async () => {
        throw new Error("database unavailable");
      }
    } as never
  );

  const readiness = await service.getReadiness();
  assert.equal(readiness.status, "degraded");
  assert.equal(readiness.checks.database, "unavailable");
}

async function testProtectedHealthDetails() {
  const service = new SystemHealthService(
    {
      $queryRawUnsafe: async () => [{ "?column?": 1 }],
      mediaAsset: {
        count: async () => 2
      },
      consignation: {
        count: async () => 1
      },
      reportSnapshot: {
        count: async () => 3
      },
      reminderRule: {
        count: async () => 4
      },
      deviceSession: {
        count: async () => 5
      },
      auditLog: {
        count: async () => 0
      }
    } as never
  );

  const details = await service.getProtectedHealthDetails();
  assert.equal(details.status, "attention");
  assert.equal(details.checks.failedUploads, 2);
  assert.equal(details.checks.failedEmails, 1);
  assert.equal(details.checks.reportSnapshots, 3);
}

async function testAppObservability() {
  const service = new SystemHealthService(
    {
      $queryRawUnsafe: async () => [{ "?column?": 1 }],
      mediaAsset: {
        count: async (input?: { where?: unknown }) => (input?.where ? 1 : 0)
      },
      consignation: {
        count: async () => 0
      },
      reportSnapshot: {
        count: async () => 0
      },
      reminderRule: {
        count: async () => 0
      },
      deviceSession: {
        count: async () => 2
      },
      auditLog: {
        count: async () => 0
      }
    } as never
  );

  const observability = await service.getAppObservability();
  assert.equal(observability.checks.database, "ok");
  assert.equal(observability.checks.activeSessions, 2);
  assert.equal(observability.metrics.prometheusPath, "/api/v1/metrics");
}

async function testPrometheusMetricsRendering() {
  const metrics = new RequestMetricsService();
  metrics.recordRequest({
    method: "GET",
    route: "/api/v1/system-health/readiness",
    statusCode: 200,
    durationMs: 12.34
  });

  const output = metrics.renderPrometheusMetrics();
  assert.match(output, /capris_process_uptime_seconds/);
  assert.match(output, /capris_http_requests_total\{method="GET",route="\/api\/v1\/system-health\/readiness",status_code="200"\} 1/);
  assert.match(output, /capris_http_request_duration_ms_sum\{method="GET",route="\/api\/v1\/system-health\/readiness"\} 12\.340/);
}

async function main() {
  await testLiveness();
  await testReadinessWhenDatabaseIsReachable();
  await testReadinessWhenDatabaseIsUnavailable();
  await testProtectedHealthDetails();
  await testAppObservability();
  await testPrometheusMetricsRendering();
  console.log("System health tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
