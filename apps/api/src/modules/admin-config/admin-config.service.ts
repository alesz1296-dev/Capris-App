import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AdminConfigBootstrap,
  AdminConfigMutationResult,
  AdminSettings,
  CreateReminderRuleInput,
  ImportCsvInput,
  ImportFailure,
  ImportResult,
  ReminderRule,
  UpdateAdminSettingsInput,
  UpdateReminderRuleInput
} from "@capris/shared";
import { CatalogsService } from "../catalogs/catalogs.service";
import { IdentityAccessService } from "../identity-access/identity-access.service";
import { PrismaService } from "../database/prisma.service";

type AdminConfigPrisma = PrismaService & {
  reminderRule: any;
  adminSettings: any;
  user: any;
  client: any;
  province: any;
  zone: any;
  pointOfSale: any;
  activityType: any;
  taskType: any;
};

@Injectable()
export class AdminConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogsService: CatalogsService,
    private readonly identityAccessService: IdentityAccessService
  ) {}

  async getBootstrap(): Promise<AdminConfigBootstrap> {
    const [reminderRules, settings] = await Promise.all([this.getReminderRules(), this.getSettings()]);
    return { reminderRules, settings };
  }

  async getReminderRules(): Promise<ReminderRule[]> {
    const items = await (this.prisma as unknown as AdminConfigPrisma).reminderRule.findMany({
      orderBy: [{ createdAt: "desc" }]
    });
    return items.map((item: any) => this.toReminderRule(item));
  }

  async createReminderRule(input: CreateReminderRuleInput): Promise<AdminConfigMutationResult<ReminderRule>> {
    const created = await (this.prisma as unknown as AdminConfigPrisma).reminderRule.create({
      data: {
        id: this.createId("reminder"),
        organizationId: input.organizationId,
        name: input.name.trim(),
        eventType: input.eventType,
        channel: input.channel,
        offsetMinutes: input.offsetMinutes,
        active: input.active ?? true
      }
    });

    return {
      item: this.toReminderRule(created),
      message: `Reminder rule ${created.id} created.`
    };
  }

  async updateReminderRule(id: string, input: UpdateReminderRuleInput): Promise<AdminConfigMutationResult<ReminderRule>> {
    const existing = await (this.prisma as unknown as AdminConfigPrisma).reminderRule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Reminder rule ${id} was not found.`);
    }

    const updated = await (this.prisma as unknown as AdminConfigPrisma).reminderRule.update({
      where: { id },
      data: {
        organizationId: input.organizationId,
        name: input.name?.trim(),
        eventType: input.eventType,
        channel: input.channel,
        offsetMinutes: input.offsetMinutes,
        active: input.active
      }
    });

    return {
      item: this.toReminderRule(updated),
      message: `Reminder rule ${updated.id} updated.`
    };
  }

  async getSettings(): Promise<AdminSettings> {
    const existing = await (this.prisma as unknown as AdminConfigPrisma).adminSettings.findUnique({
      where: { organizationId: "org_capris" }
    });

    if (!existing) {
      return {
        organizationId: "org_capris",
        defaultRecipientEmails: [],
        retentionPhotoDays: 365,
        retentionGpsDays: 180,
        retentionAuditDays: 730
      };
    }

    return this.toSettings(existing);
  }

  async updateSettings(input: UpdateAdminSettingsInput): Promise<AdminConfigMutationResult<AdminSettings>> {
    const updated = await (this.prisma as unknown as AdminConfigPrisma).adminSettings.upsert({
      where: { organizationId: input.organizationId },
      update: {
        defaultRecipientEmails: JSON.stringify(input.defaultRecipientEmails),
        retentionPhotoDays: input.retentionPhotoDays,
        retentionGpsDays: input.retentionGpsDays,
        retentionAuditDays: input.retentionAuditDays
      },
      create: {
        organizationId: input.organizationId,
        defaultRecipientEmails: JSON.stringify(input.defaultRecipientEmails),
        retentionPhotoDays: input.retentionPhotoDays,
        retentionGpsDays: input.retentionGpsDays,
        retentionAuditDays: input.retentionAuditDays
      }
    });

    return {
      item: this.toSettings(updated),
      message: `Admin settings for ${updated.organizationId} updated.`
    };
  }

  async runImport(input: ImportCsvInput): Promise<ImportResult> {
    const rows = parseCsv(input.csvContent);
    if (!rows.length) {
      throw new BadRequestException("CSV content must include a header row and at least one data row.");
    }

    const [header, ...dataRows] = rows;
    const failures: ImportFailure[] = [];
    let createdCount = 0;
    let updatedCount = 0;

    for (let index = 0; index < dataRows.length; index += 1) {
      const rowNumber = index + 2;
      const rowObject = Object.fromEntries(header.map((key, cellIndex) => [key, dataRows[index][cellIndex] ?? ""]));

      try {
        const result = await this.importRow(input.organizationId, input.entityType, rowObject);
        createdCount += result === "created" ? 1 : 0;
        updatedCount += result === "updated" ? 1 : 0;
      } catch (error) {
        failures.push({
          rowNumber,
          reason: error instanceof Error ? error.message : "Unknown import failure."
        });
      }
    }

    return {
      entityType: input.entityType,
      createdCount,
      updatedCount,
      failedCount: failures.length,
      failures
    };
  }

  private async importRow(organizationId: string, entityType: ImportCsvInput["entityType"], row: Record<string, string>) {
    const prisma = this.prisma as unknown as AdminConfigPrisma;

    if (entityType === "users") {
      const email = required(row.email, "email").toLowerCase();
      const role = required(row.role, "role");
      const locale = required(row.locale, "locale");
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        await prisma.user.update({
          where: { email },
          data: {
            name: required(row.name, "name"),
            role,
            locale,
            active: parseBoolean(row.active, true)
          }
        });
        return "updated";
      }
      await prisma.user.create({
        data: {
          id: this.createId("user"),
          organizationId,
          name: required(row.name, "name"),
          email,
          role,
          locale,
          active: parseBoolean(row.active, true)
        }
      });
      return "created";
    }

    if (entityType === "clients") {
      return this.upsertByCode("client", organizationId, row, {
        name: required(row.name, "name"),
        contactEmail: row.contactEmail?.trim() || null,
        active: parseBoolean(row.active, true)
      });
    }

    if (entityType === "provinces") {
      return this.upsertByCode("province", organizationId, row, {
        country: "Costa Rica",
        name: required(row.name, "name"),
        active: parseBoolean(row.active, true)
      });
    }

    if (entityType === "zones") {
      const provinceCode = required(row.provinceCode, "provinceCode").toUpperCase();
      const province = await prisma.province.findFirst({ where: { organizationId, code: provinceCode } });
      if (!province) {
        throw new Error(`Province code ${provinceCode} was not found.`);
      }
      return this.upsertByCode("zone", organizationId, row, {
        provinceId: province.id,
        name: required(row.name, "name"),
        active: parseBoolean(row.active, true)
      });
    }

    if (entityType === "points_of_sale") {
      const provinceCode = required(row.provinceCode, "provinceCode").toUpperCase();
      const zoneCode = required(row.zoneCode, "zoneCode").toUpperCase();
      const clientCode = required(row.clientCode, "clientCode").toUpperCase();
      const [province, zone, client] = await Promise.all([
        prisma.province.findFirst({ where: { organizationId, code: provinceCode } }),
        prisma.zone.findFirst({ where: { organizationId, code: zoneCode } }),
        prisma.client.findFirst({ where: { organizationId, code: clientCode } })
      ]);
      if (!province) throw new Error(`Province code ${provinceCode} was not found.`);
      if (!zone) throw new Error(`Zone code ${zoneCode} was not found.`);
      if (!client) throw new Error(`Client code ${clientCode} was not found.`);

      return this.upsertByCode("pointOfSale", organizationId, row, {
        provinceId: province.id,
        zoneId: zone.id,
        clientId: client.id,
        name: required(row.name, "name"),
        address: row.address?.trim() || null,
        latitude: row.latitude ? Number(row.latitude) : null,
        longitude: row.longitude ? Number(row.longitude) : null,
        active: parseBoolean(row.active, true)
      });
    }

    if (entityType === "activity_types") {
      return this.upsertByCode("activityType", organizationId, row, {
        name: required(row.name, "name"),
        active: parseBoolean(row.active, true)
      });
    }

    return this.upsertByCode("taskType", organizationId, row, {
      name: required(row.name, "name"),
      active: parseBoolean(row.active, true)
    });
  }

  private async upsertByCode(
    delegateName: "client" | "province" | "zone" | "pointOfSale" | "activityType" | "taskType",
    organizationId: string,
    row: Record<string, string>,
    extraData: Record<string, unknown>
  ) {
    const delegate = (this.prisma as unknown as AdminConfigPrisma)[delegateName];
    const code = required(row.code, "code").toUpperCase();
    const existing = await delegate.findFirst({ where: { organizationId, code } });
    if (existing) {
      await delegate.update({
        where: { id: existing.id },
        data: { code, ...extraData }
      });
      return "updated";
    }
    await delegate.create({
      data: {
        id: this.createId(delegateName.toLowerCase()),
        organizationId,
        code,
        ...extraData
      }
    });
    return "created";
  }

  private toReminderRule(item: {
    id: string;
    organizationId: string;
    name: string;
    eventType: ReminderRule["eventType"];
    channel: ReminderRule["channel"];
    offsetMinutes: number;
    active: boolean;
  }): ReminderRule {
    return {
      id: item.id,
      organizationId: item.organizationId,
      name: item.name,
      eventType: item.eventType,
      channel: item.channel,
      offsetMinutes: item.offsetMinutes,
      active: item.active
    };
  }

  private toSettings(item: {
    organizationId: string;
    defaultRecipientEmails: string;
    retentionPhotoDays: number;
    retentionGpsDays: number;
    retentionAuditDays: number;
  }): AdminSettings {
    return {
      organizationId: item.organizationId,
      defaultRecipientEmails: item.defaultRecipientEmails ? (JSON.parse(item.defaultRecipientEmails) as string[]) : [],
      retentionPhotoDays: item.retentionPhotoDays,
      retentionGpsDays: item.retentionGpsDays,
      retentionAuditDays: item.retentionAuditDays
    };
  }

  private createId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function required(value: string | undefined, fieldName: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }
  return normalized;
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value?.trim()) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function parseCsv(csvContent: string) {
  return csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => splitCsvLine(line).map((cell) => cell.trim()));
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current);
  return cells;
}
