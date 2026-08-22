export interface AppObservabilityResponse {
  generatedAt: string;
  status: "ok" | "attention" | "degraded";
  runtime: {
    nodeEnv: string;
    uptimeSeconds: number;
    version: string;
    deploymentId: string;
  };
  checks: {
    api: "ok";
    database: "ok" | "unavailable";
    failedUploads: number;
    pendingUploads: number;
    failedEmails: number;
    reportExportFailures: number;
    activeSessions: number;
  };
  metrics: {
    prometheusPath: "/api/v1/metrics";
    protectedHealthDetailsPath: "/api/v1/system-health/details";
  };
}

