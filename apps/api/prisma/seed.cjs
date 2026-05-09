process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/capris_app?schema=public";

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function main() {
  const existingOrganizationCount = await prisma.organization.count();

  if (existingOrganizationCount > 0) {
    console.log("Seed skipped: database already contains organizations.");
    return;
  }

  await prisma.organization.create({
    data: {
      id: "org_capris",
      name: "Capris Costa Rica",
      defaultLocale: "es",
      timezone: "America/Costa_Rica",
      active: true
    }
  });

  await prisma.user.createMany({
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

  await prisma.team.create({
    data: {
      id: "team_central",
      organizationId: "org_capris",
      name: "Central Route Team",
      leadUserId: "user_supervisor_001",
      active: true
    }
  });

  await prisma.supervisorScope.createMany({
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

  await prisma.province.createMany({
    data: [
      {
        id: "province_san_jose",
        organizationId: "org_capris",
        country: "Costa Rica",
        name: "San Jose",
        code: "SJ",
        active: true
      },
      {
        id: "province_alajuela",
        organizationId: "org_capris",
        country: "Costa Rica",
        name: "Alajuela",
        code: "AL",
        active: true
      }
    ]
  });

  await prisma.zone.createMany({
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

  await prisma.client.createMany({
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

  await prisma.pointOfSale.create({
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

  await prisma.activityType.createMany({
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

  await prisma.taskType.createMany({
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
        name: "Activity",
        code: "ACTIVATION",
        active: true
      }
    ]
  });

  await prisma.workflowRule.createMany({
    data: [
      {
        id: "workflow_visit_exhibition",
        organizationId: "org_capris",
        taskTypeId: "task_visit",
        activityTypeId: "activity_exhibition",
        requiresBeforePhoto: true,
        requiresAfterPhoto: true,
        requiresGps: true,
        requiresComment: false,
        requiresSupervisorApproval: false,
        requiresConsignationEmail: false
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

  await prisma.agendaEvent.create({
    data: {
      id: "agenda_team_sync_001",
      organizationId: "org_capris",
      title: "Central route weekly sync",
      description: "Supervisor follow-up for route coverage, client requests, and pending evidence.",
      startAt: "2026-05-08T15:00:00.000Z",
      endAt: "2026-05-08T16:00:00.000Z",
      allDay: false,
      scopeType: "team",
      scopeReferenceId: "team_central",
      ownerUserId: "user_supervisor_001",
      teamId: "team_central",
      colorToken: "agenda",
      createdByUserId: "user_admin_001"
    }
  });

  await prisma.clientRequest.create({
    data: {
      id: "request_caps_001",
      organizationId: "org_capris",
      title: "Replace missing shelf talker",
      description: "Client requested updated material before the next weekend promotion.",
      requesterName: "Auto Mercado trade team",
      requesterEmail: "trade@automercado.example",
      ownerUserId: "user_supervisor_001",
      clientId: "client_auto_mercado",
      provinceId: "province_san_jose",
      zoneId: "zone_central",
      pointOfSaleId: "pos_escazu_001",
      status: "open",
      dueDate: "2026-05-10",
      openedAt: "2026-05-08T14:30:00.000Z",
      priority: "high"
    }
  });

  await prisma.task.create({
    data: {
      id: "task_launch_display",
      organizationId: "org_capris",
      title: "Install launch display at Escazu Plaza",
      requesterId: "user_admin_001",
      assigneeId: "user_field_001",
      scheduledFor: "2026-05-08",
      provinceId: "province_san_jose",
      zoneId: "zone_central",
      clientId: "client_auto_mercado",
      pointOfSaleId: "pos_escazu_001",
      activityTypeId: "activity_exhibition",
      taskTypeId: "task_visit",
      status: "pending",
      priority: "high",
      difficulty: "standard"
    }
  });

  await prisma.visit.create({
    data: {
      id: "visit_launch_display",
      organizationId: "org_capris",
      taskId: "task_launch_display",
      assigneeId: "user_field_001",
      scheduledFor: "2026-05-08",
      provinceId: "province_san_jose",
      zoneId: "zone_central",
      pointOfSaleId: "pos_escazu_001",
      status: "scheduled"
    }
  });

  await prisma.mediaAsset.create({
    data: {
      id: "media_before_launch_display",
      organizationId: "org_capris",
      uploaderUserId: "user_field_001",
      fileName: "launch-display-before.jpg",
      mimeType: "image/jpeg",
      originalStoragePath: "/mock-storage/originals/launch-display-before.jpg",
      thumbnailStoragePath: "/mock-storage/thumbs/launch-display-before.jpg",
      capturedAt: "2026-05-08T13:40:00.000Z",
      uploadStatus: "uploaded",
      byteSize: 248000,
      width: 1440,
      height: 1080
    }
  });

  await prisma.evidencePhoto.create({
    data: {
      id: "evidence_before_launch_display",
      organizationId: "org_capris",
      uploaderUserId: "user_field_001",
      taskId: "task_launch_display",
      visitId: "visit_launch_display",
      mediaAssetId: "media_before_launch_display",
      type: "before",
      capturedAt: "2026-05-08T13:40:00.000Z",
      latitude: 9.9186,
      longitude: -84.1397
    }
  });

  console.log("Seed completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
