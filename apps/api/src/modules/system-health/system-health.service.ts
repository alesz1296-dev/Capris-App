import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";

type SystemHealthPrisma = PrismaService & {
  mediaAsset: any;
  consignation: any;
  reportSnapshot: any;
  reminderRule: any;
  deviceSession: any;
};

@Injectable()
export class SystemHealthService {
  constructor(private readonly prisma: PrismaService) {}

  getPublicHealth() {
    return {
      status: "ok",
      checks: {
        api: "ok",
        syncQueue: "pending_integration",
        email: "pending_integration",
        media: "pending_integration"
      }
    };
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
}
