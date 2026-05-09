import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";

type ReplayProtectionPrisma = PrismaService & {
  syncReceipt: any;
};

@Injectable()
export class ReplayProtectionService {
  constructor(private readonly prisma: PrismaService) {}

  async getCachedResult<TResult>(organizationId: string, operationType: string, operationId?: string): Promise<TResult | null> {
    if (!operationId) {
      return null;
    }

    const receipt = await (this.prisma as unknown as ReplayProtectionPrisma).syncReceipt.findUnique({
      where: {
        organizationId_operationId_operationType: {
          organizationId,
          operationId,
          operationType
        }
      }
    });

    if (!receipt?.responseJson) {
      return null;
    }

    return JSON.parse(receipt.responseJson) as TResult;
  }

  async recordResult<TResult>(organizationId: string, operationType: string, operationId: string | undefined, response: TResult) {
    if (!operationId) {
      return;
    }

    await (this.prisma as unknown as ReplayProtectionPrisma).syncReceipt.upsert({
      where: {
        organizationId_operationId_operationType: {
          organizationId,
          operationId,
          operationType
        }
      },
      update: {
        responseJson: JSON.stringify(response)
      },
      create: {
        id: this.createId("sync_receipt"),
        organizationId,
        operationId,
        operationType,
        responseJson: JSON.stringify(response)
      }
    });
  }

  private createId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
