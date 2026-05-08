import { Injectable, OnModuleInit } from "@nestjs/common";
import { DEFAULT_COUNTRY, DEFAULT_FIELD_WORKFLOW_RULE, DEFAULT_TIMEZONE } from "@capris/shared";
import { PrismaService } from "./prisma.service";

@Injectable()
export class DatabaseSeederService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const existingOrganizationCount = await this.prisma.organization.count();

    if (existingOrganizationCount > 0) {
      return;
    }

    await this.prisma.organization.create({
      data: {
        id: "org_capris",
        name: "Capris Costa Rica",
        defaultLocale: "es",
        timezone: DEFAULT_TIMEZONE,
        active: true
      }
    });

    await this.prisma.user.createMany({
      data: [
        {
          id: "user_admin_001",
          organizationId: "org_capris",
          name: "Maria Solis",
          email: "maria.solis@capris.example",
          role: "admin",
          locale: "es",
          active: true
        },
        {
          id: "user_supervisor_001",
          organizationId: "org_capris",
          name: "Daniel Rojas",
          email: "daniel.rojas@capris.example",
          role: "supervisor",
          locale: "es",
          active: true
        },
        {
          id: "user_field_001",
          organizationId: "org_capris",
          name: "Lucia Vargas",
          email: "lucia.vargas@capris.example",
          role: "field_user",
          locale: "en",
          active: true
        }
      ]
    });

    await this.prisma.team.create({
      data: {
        id: "team_central",
        organizationId: "org_capris",
        name: "Central Route Team",
        leadUserId: "user_supervisor_001",
        active: true
      }
    });

    await this.prisma.supervisorScope.createMany({
      data: [
        {
          id: "scope_org_capris",
          organizationId: "org_capris",
          userId: "user_supervisor_001",
          type: "organization",
          referenceId: "org_capris",
          referenceName: "Capris Costa Rica",
          active: true
        },
        {
          id: "scope_team_central",
          organizationId: "org_capris",
          userId: "user_supervisor_001",
          type: "team",
          referenceId: "team_central",
          referenceName: "Central Route Team",
          active: true
        },
        {
          id: "scope_province_san_jose",
          organizationId: "org_capris",
          userId: "user_supervisor_001",
          type: "province",
          referenceId: "province_san_jose",
          referenceName: "San Jose",
          active: true
        }
      ]
    });

    await this.prisma.province.createMany({
      data: [
        {
          id: "province_san_jose",
          organizationId: "org_capris",
          country: DEFAULT_COUNTRY,
          name: "San Jose",
          code: "SJ",
          active: true
        },
        {
          id: "province_alajuela",
          organizationId: "org_capris",
          country: DEFAULT_COUNTRY,
          name: "Alajuela",
          code: "AL",
          active: true
        }
      ]
    });

    await this.prisma.zone.createMany({
      data: [
        {
          id: "zone_central",
          organizationId: "org_capris",
          provinceId: "province_san_jose",
          name: "Central",
          code: "CENTRAL",
          active: true
        },
        {
          id: "zone_west",
          organizationId: "org_capris",
          provinceId: "province_alajuela",
          name: "West",
          code: "WEST",
          active: true
        }
      ]
    });

    await this.prisma.client.createMany({
      data: [
        {
          id: "client_auto_mercado",
          organizationId: "org_capris",
          name: "Auto Mercado",
          code: "AUTOMERCADO",
          contactEmail: "trade@automercado.example",
          active: true
        },
        {
          id: "client_walmart",
          organizationId: "org_capris",
          name: "Walmart",
          code: "WALMART",
          contactEmail: "ops@walmart.example",
          active: true
        }
      ]
    });

    await this.prisma.pointOfSale.create({
      data: {
        id: "pos_escazu_001",
        organizationId: "org_capris",
        provinceId: "province_san_jose",
        zoneId: "zone_central",
        clientId: "client_auto_mercado",
        name: "Escazu Plaza",
        code: "ESCAZU-001",
        address: "Escazu, San Jose",
        latitude: 9.9186,
        longitude: -84.1397,
        active: true
      }
    });

    await this.prisma.activityType.createMany({
      data: [
        {
          id: "activity_exhibition",
          organizationId: "org_capris",
          name: "Exhibition Installation",
          code: "EXHIBITION",
          active: true
        },
        {
          id: "activity_consignation",
          organizationId: "org_capris",
          name: "Consignation",
          code: "CONSIGNATION",
          active: true
        }
      ]
    });

    await this.prisma.taskType.createMany({
      data: [
        {
          id: "task_visit",
          organizationId: "org_capris",
          name: "Store Visit",
          code: "STORE_VISIT",
          active: true
        },
        {
          id: "task_activation",
          organizationId: "org_capris",
          name: "Activation",
          code: "ACTIVATION",
          active: true
        }
      ]
    });

    await this.prisma.workflowRule.createMany({
      data: [
        {
          id: "workflow_visit_exhibition",
          organizationId: "org_capris",
          taskTypeId: "task_visit",
          activityTypeId: "activity_exhibition",
          ...DEFAULT_FIELD_WORKFLOW_RULE
        },
        {
          id: "workflow_activation_consignation",
          organizationId: "org_capris",
          taskTypeId: "task_activation",
          activityTypeId: "activity_consignation",
          requiresBeforePhoto: true,
          requiresAfterPhoto: true,
          requiresGps: true,
          requiresComment: true,
          requiresSupervisorApproval: false,
          requiresConsignationEmail: true
        }
      ]
    });
  }
}
