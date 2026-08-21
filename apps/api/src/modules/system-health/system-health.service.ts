import { Injectable } from "@nestjs/common";
import type { AppObservabilityResponse } from "@capris/shared";
import { PrismaService } from "../database/prisma.service";

type SystemHealthPrisma = PrismaService & {
  $queryRawUnsafe: (query: string) => Promise<unknown>;
  mediaAsset: any;
  consignation: any;
  reportSnapshot: any;
  reminderRule: any;
  deviceSession: any;
  auditLog: any;
};

@Injectable()
export class SystemHealthService {
  constructor(private readonly prisma: PrismaService) {}

  getLiveness() {
    return {
      status: "ok",
      checks: {
        api: "ok",
        process: "ok"
      },
      runtime: {
        nodeEnv: process.env.NODE_ENV ?? "development",
        uptimeSeconds: Math.floor(process.uptime())
      }
    };
  }

  async getReadiness() {
    try {
      await (this.prisma as unknown as SystemHealthPrisma).$queryRawUnsafe("SELECT 1");
      return {
        status: "ok",
        checks: {
          api: "ok",
          database: "ok"
        },
        runtime: {
          nodeEnv: process.env.NODE_ENV ?? "development"
        }
      };
    } catch {
      return {
        status: "degraded",
        checks: {
          api: "ok",
          database: "unavailable"
        },
        runtime: {
          nodeEnv: process.env.NODE_ENV ?? "development"
        }
      };
    }
  }

  async getProtectedHealthDetails() {
    const prisma = this.prisma as unknown as SystemHealthPrisma;
    const [failedUploads, failedEmails, snapshots, reminderRules, activeSessions] = await Promise.all([
      prisma.mediaAsset.count({
        where: {
          OR: [{ uploadStatus: "failed" }, { syncState: "sync_failed" }]
        }
      }),
      prisma.consignation.count({ where: { status: "failed" } }),
      prisma.reportSnapshot.count(),
      prisma.reminderRule.count({ where: { active: true } }),
      prisma.deviceSession.count({ where: { revokedAt: null } })
    ]);

    return {
      status: failedUploads || failedEmails ? "attention" : "ok",
      checks: {
        api: "ok",
        failedUploads,
        failedEmails,
        reportSnapshots: snapshots,
        activeReminderRules: reminderRules,
        activeDeviceSessions: activeSessions
      }
    };
  }

  async getAppObservability(): Promise<AppObservabilityResponse> {
    const prisma = this.prisma as unknown as SystemHealthPrisma;
    const readiness = await this.getReadiness();
    const databaseStatus = readiness.status === "ok" ? "ok" : "unavailable";
    const [failedUploads, pendingUploads, failedEmails, reportExportFailures, activeSessions] = await Promise.all([
      prisma.mediaAsset.count({
        where: {
          OR: [{ uploadStatus: "failed" }, { syncState: "sync_failed" }]
        }
      }),
      prisma.mediaAsset.count({
        where: {
          uploadStatus: { in: ["pending_upload", "uploading"] }
        }
      }),
      prisma.consignation.count({ where: { status: "failed" } }),
      prisma.auditLog.count({
        where: {
          action: "report.export_csv",
          status: "failed"
        }
      }),
      prisma.deviceSession.count({ where: { revokedAt: null } })
    ]);

    return {
      generatedAt: new Date().toISOString(),
      status: readiness.status === "ok" && !failedUploads && !failedEmails && !reportExportFailures ? "ok" : readiness.status === "ok" ? "attention" : "degraded",
      runtime: {
        nodeEnv: process.env.NODE_ENV ?? "development",
        uptimeSeconds: Math.floor(process.uptime()),
        version: process.env.npm_package_version ?? "0.1.0",
        deploymentId:
          process.env.CAPRIS_DEPLOYMENT_ID?.trim() ||
          process.env.RAILWAY_DEPLOYMENT_ID?.trim() ||
          process.env.RAILWAY_GIT_COMMIT_SHA?.trim()?.slice(0, 7) ||
          "local"
      },
      checks: {
        api: "ok",
        database: databaseStatus,
        failedUploads,
        pendingUploads,
        failedEmails,
        reportExportFailures,
        activeSessions
      },
      metrics: {
        prometheusPath: "/api/v1/metrics",
        protectedHealthDetailsPath: "/api/v1/system-health/details"
      }
    };
  }
}
