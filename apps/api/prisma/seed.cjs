if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set before running the seed script.");
}

const { PrismaClient } = require("@prisma/client");
const { randomBytes, scrypt: scryptCallback } = require("node:crypto");
const { promisify } = require("node:util");

const scrypt = promisify(scryptCallback);
const ORGANIZATION_ID = "org_capris";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

const provinces = [
  { id: "province_san_jose", code: "SJ", name: "San José" },
  { id: "province_alajuela", code: "AL", name: "Alajuela" },
  { id: "province_cartago", code: "CA", name: "Cartago" },
  { id: "province_heredia", code: "HE", name: "Heredia" },
  { id: "province_guanacaste", code: "GU", name: "Guanacaste" },
  { id: "province_puntarenas", code: "PU", name: "Puntarenas" },
  { id: "province_limon", code: "LI", name: "Limón" }
];

const cantons = [
  { id: "canton_san_jose", provinceId: "province_san_jose", code: "SJ-SAN-JOSE", name: "San José" },
  { id: "canton_escazu", provinceId: "province_san_jose", code: "SJ-ESCAZU", name: "Escazú" },
  { id: "canton_santa_ana", provinceId: "province_san_jose", code: "SJ-SANTA-ANA", name: "Santa Ana" },
  { id: "canton_alajuela", provinceId: "province_alajuela", code: "AL-ALAJUELA", name: "Alajuela" },
  { id: "canton_san_carlos", provinceId: "province_alajuela", code: "AL-SAN-CARLOS", name: "San Carlos" },
  { id: "canton_cartago", provinceId: "province_cartago", code: "CA-CARTAGO", name: "Cartago" },
  { id: "canton_la_union", provinceId: "province_cartago", code: "CA-LA-UNION", name: "La Unión" },
  { id: "canton_heredia", provinceId: "province_heredia", code: "HE-HEREDIA", name: "Heredia" },
  { id: "canton_belen", provinceId: "province_heredia", code: "HE-BELEN", name: "Belén" },
  { id: "canton_liberia", provinceId: "province_guanacaste", code: "GU-LIBERIA", name: "Liberia" },
  { id: "canton_carrillo", provinceId: "province_guanacaste", code: "GU-CARRILLO", name: "Carrillo" },
  { id: "canton_puntarenas", provinceId: "province_puntarenas", code: "PU-PUNTARENAS", name: "Puntarenas" },
  { id: "canton_quepos", provinceId: "province_puntarenas", code: "PU-QUEPOS", name: "Quepos" },
  { id: "canton_limon", provinceId: "province_limon", code: "LI-LIMON", name: "Limón" },
  { id: "canton_pococi", provinceId: "province_limon", code: "LI-POCOCI", name: "Pococí" }
];

const districtGroups = [
  ["canton_san_jose", "province_san_jose", "SJ-SAN-JOSE", ["Carmen", "Merced", "Hospital", "Catedral", "Zapote", "San Francisco de Dos Ríos", "Uruca", "Mata Redonda", "Pavas", "Hatillo", "San Sebastián"]],
  ["canton_escazu", "province_san_jose", "SJ-ESCAZU", ["Escazú", "San Antonio", "San Rafael"]],
  ["canton_santa_ana", "province_san_jose", "SJ-SANTA-ANA", ["Santa Ana", "Salitral", "Pozos", "Uruca", "Piedades", "Brasil"]],
  ["canton_alajuela", "province_alajuela", "AL-ALAJUELA", ["Alajuela", "San José", "Carrizal", "San Antonio", "Guácima", "San Isidro", "Sabanilla", "San Rafael", "Río Segundo", "Desamparados", "Turrúcares", "Tambor", "Garita", "Sarapiquí"]],
  ["canton_san_carlos", "province_alajuela", "AL-SAN-CARLOS", ["Quesada", "Florencia", "Buenavista", "Aguas Zarcas", "Venecia", "Pital", "Fortuna", "Tigra", "Palmera", "Venado", "Cutris", "Monterrey", "Pocosol"]],
  ["canton_cartago", "province_cartago", "CA-CARTAGO", ["Oriental", "Occidental", "Carmen", "San Nicolás", "Agua Caliente", "Guadalupe", "Corralillo", "Tierra Blanca", "Dulce Nombre", "Llano Grande", "Quebradilla"]],
  ["canton_la_union", "province_cartago", "CA-LA-UNION", ["Tres Ríos", "San Diego", "San Juan", "San Rafael", "Concepción", "Dulce Nombre", "San Ramón", "Río Azul"]],
  ["canton_heredia", "province_heredia", "HE-HEREDIA", ["Heredia", "Mercedes", "San Francisco", "Ulloa", "Varablanca"]],
  ["canton_belen", "province_heredia", "HE-BELEN", ["San Antonio", "La Ribera", "La Asunción"]],
  ["canton_liberia", "province_guanacaste", "GU-LIBERIA", ["Liberia", "Cañas Dulces", "Mayorga", "Nacascolo", "Curubandé"]],
  ["canton_carrillo", "province_guanacaste", "GU-CARRILLO", ["Filadelfia", "Palmira", "Sardinal", "Belén"]],
  ["canton_puntarenas", "province_puntarenas", "PU-PUNTARENAS", ["Puntarenas", "Pitahaya", "Chomes", "Lepanto", "Paquera", "Manzanillo", "Guacimal", "Barranca", "Monte Verde", "Isla del Coco", "Cóbano", "Chacarita", "Chira", "Acapulco", "El Roble", "Arancibia"]],
  ["canton_quepos", "province_puntarenas", "PU-QUEPOS", ["Quepos", "Savegre", "Naranjito"]],
  ["canton_limon", "province_limon", "LI-LIMON", ["Limón", "Valle La Estrella", "Río Blanco", "Matama"]],
  ["canton_pococi", "province_limon", "LI-POCOCI", ["Guápiles", "Jiménez", "Rita", "Roxana", "Cariari", "Colorado", "La Colonia"]]
];

const districts = districtGroups.flatMap(([cantonId, provinceId, cantonCode, names]) =>
  names.map((name, index) => {
    const districtCode = `${cantonCode}-${String(index + 1).padStart(2, "0")}`;
    return {
      id: `district_${slugify(districtCode)}`,
      organizationId: ORGANIZATION_ID,
      provinceId,
      cantonId,
      name,
      code: districtCode,
      active: true
    };
  })
);

const zones = provinces.map((province) => ({
  id: `zone_${slugify(province.code)}_default`,
  organizationId: ORGANIZATION_ID,
  provinceId: province.id,
  name: `${province.name} Field Zone`,
  code: `${province.code}-FIELD`,
  active: true
}));

const users = [
  { id: "user_admin_001", organizationId: ORGANIZATION_ID, name: "Maria Solis", email: "maria.solis@capris.example", role: "admin", locale: "es", active: true },
  { id: "user_supervisor_001", organizationId: ORGANIZATION_ID, name: "Daniel Rojas", email: "daniel.rojas@capris.example", role: "supervisor_auditor", locale: "es", active: true },
  { id: "user_developer_sre_001", organizationId: ORGANIZATION_ID, name: "Andres Campos", email: "andres.campos@capris.example", role: "developer_sre", locale: "en", active: true },
  { id: "user_field_001", organizationId: ORGANIZATION_ID, name: "Lucia Vargas", email: "lucia.vargas@capris.example", role: "field_user", locale: "es", active: true }
];

async function main() {
  const passwordHash = process.env.CAPRIS_QA_PASSWORD ? await hashPassword(process.env.CAPRIS_QA_PASSWORD) : undefined;
  const today = formatDate(new Date());
  const tomorrow = formatDate(addDays(new Date(), 1));
  const yesterday = formatDate(addDays(new Date(), -1));

  await prisma.organization.upsert({
    where: { id: ORGANIZATION_ID },
    create: { id: ORGANIZATION_ID, name: "Capris Costa Rica", defaultLocale: "es", timezone: "America/Costa_Rica", active: true },
    update: { name: "Capris Costa Rica", defaultLocale: "es", timezone: "America/Costa_Rica", active: true }
  });

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      create: { ...user, ...(passwordHash ? { passwordHash } : {}) },
      update: { ...user, ...(passwordHash ? { passwordHash } : {}) }
    });
  }

  await prisma.team.upsert({
    where: { id: "team_central" },
    create: { id: "team_central", organizationId: ORGANIZATION_ID, name: "Central Route Team", leadUserId: "user_supervisor_001", active: true },
    update: { name: "Central Route Team", leadUserId: "user_supervisor_001", active: true }
  });

  for (const province of provinces) {
    await prisma.province.upsert({
      where: { id: province.id },
      create: { ...province, organizationId: ORGANIZATION_ID, country: "Costa Rica", active: true },
      update: { country: "Costa Rica", name: province.name, code: province.code, active: true }
    });
  }

  for (const canton of cantons) {
    await prisma.canton.upsert({
      where: { id: canton.id },
      create: { ...canton, organizationId: ORGANIZATION_ID, active: true },
      update: { provinceId: canton.provinceId, name: canton.name, code: canton.code, active: true }
    });
  }

  for (const district of districts) {
    await prisma.district.upsert({
      where: { id: district.id },
      create: district,
      update: { provinceId: district.provinceId, cantonId: district.cantonId, name: district.name, code: district.code, active: true }
    });
  }

  for (const zone of zones) {
    await prisma.zone.upsert({
      where: { id: zone.id },
      create: zone,
      update: { provinceId: zone.provinceId, name: zone.name, code: zone.code, active: true }
    });
  }

  await seedSupervisorScopes();
  await seedClientsAndStores();
  await seedActivityCatalogs();
  await seedOperationalRecords({ today, tomorrow, yesterday });
  await seedAdminSettings();

  console.log("MVP seed completed.");
  console.log(`- Provinces: ${provinces.length}`);
  console.log(`- Representative cantons: ${cantons.length}`);
  console.log(`- Representative districts: ${districts.length}`);
  console.log("- QA users: maria.solis@capris.example, daniel.rojas@capris.example, andres.campos@capris.example, lucia.vargas@capris.example");
  if (!passwordHash) {
    console.log("- QA users were seeded without passwords. Set CAPRIS_QA_PASSWORD and rerun the seed to enable email/password login.");
  }
}

async function seedSupervisorScopes() {
  const scopes = [
    { id: "scope_org_capris", type: "organization", referenceId: ORGANIZATION_ID, referenceName: "Capris Costa Rica" },
    { id: "scope_team_central", type: "team", referenceId: "team_central", referenceName: "Central Route Team" },
    { id: "scope_province_san_jose", type: "province", referenceId: "province_san_jose", referenceName: "San José" }
  ];

  for (const scope of scopes) {
    await prisma.supervisorScope.upsert({
      where: {
        userId_organizationId_type_referenceId: {
          userId: "user_supervisor_001",
          organizationId: ORGANIZATION_ID,
          type: scope.type,
          referenceId: scope.referenceId
        }
      },
      create: { ...scope, organizationId: ORGANIZATION_ID, userId: "user_supervisor_001", active: true },
      update: { referenceName: scope.referenceName, active: true }
    });
  }
}

async function seedClientsAndStores() {
  const clients = [
    { id: "client_auto_mercado", name: "Auto Mercado", code: "AUTOMERCADO", contactEmail: "trade@automercado.example" },
    { id: "client_walmart", name: "Walmart", code: "WALMART", contactEmail: "ops@walmart.example" },
    { id: "client_price_smart", name: "PriceSmart", code: "PRICESMART", contactEmail: "ops@pricesmart.example" }
  ];

  for (const client of clients) {
    await prisma.client.upsert({
      where: { id: client.id },
      create: { ...client, organizationId: ORGANIZATION_ID, active: true },
      update: { name: client.name, code: client.code, contactEmail: client.contactEmail, active: true }
    });
  }

  const stores = [
    {
      id: "pos_escazu_001",
      provinceId: "province_san_jose",
      cantonId: "canton_escazu",
      districtId: "district_sj_escazu_03",
      zoneId: "zone_sj_default",
      clientId: "client_auto_mercado",
      name: "Escazú Plaza",
      code: "ESCAZU-001",
      address: "San Rafael de Escazú, San José"
    },
    {
      id: "pos_santa_ana_001",
      provinceId: "province_san_jose",
      cantonId: "canton_santa_ana",
      districtId: "district_sj_santa_ana_03",
      zoneId: "zone_sj_default",
      clientId: "client_walmart",
      name: "Santa Ana Center",
      code: "SANTA-ANA-001",
      address: "Pozos, Santa Ana, San José"
    },
    {
      id: "pos_heredia_001",
      provinceId: "province_heredia",
      cantonId: "canton_belen",
      districtId: "district_he_belen_01",
      zoneId: "zone_he_default",
      clientId: "client_price_smart",
      name: "Belén Store",
      code: "BELEN-001",
      address: "San Antonio de Belén, Heredia"
    }
  ];

  for (const store of stores) {
    await prisma.pointOfSale.upsert({
      where: { id: store.id },
      create: { ...store, organizationId: ORGANIZATION_ID, active: true },
      update: { ...store, active: true }
    });
  }
}

async function seedActivityCatalogs() {
  const activityTypes = [
    { id: "activity_exhibition", name: "Exhibition Installation", code: "EXHIBITION" },
    { id: "activity_consignation", name: "Consignation", code: "CONSIGNATION" },
    { id: "activity_audit", name: "Shelf Audit", code: "SHELF_AUDIT" },
    { id: "activity_training", name: "Client Training", code: "CLIENT_TRAINING" }
  ];

  const taskTypes = [
    { id: "task_visit", name: "Store Visit", code: "STORE_VISIT" },
    { id: "task_activation", name: "Activity", code: "ACTIVATION" },
    { id: "task_follow_up", name: "Follow-up", code: "FOLLOW_UP" }
  ];

  for (const activity of activityTypes) {
    await prisma.activityType.upsert({
      where: { id: activity.id },
      create: { ...activity, organizationId: ORGANIZATION_ID, active: true },
      update: { name: activity.name, code: activity.code, active: true }
    });
  }

  for (const taskType of taskTypes) {
    await prisma.taskType.upsert({
      where: { id: taskType.id },
      create: { ...taskType, organizationId: ORGANIZATION_ID, active: true },
      update: { name: taskType.name, code: taskType.code, active: true }
    });
  }

  const workflowRules = [
    {
      id: "workflow_visit_exhibition",
      taskTypeId: "task_visit",
      activityTypeId: "activity_exhibition",
      requiresBeforePhoto: true,
      requiresAfterPhoto: true,
      requiresComment: false,
      requiresSupervisorApproval: false,
      requiresConsignationEmail: false
    },
    {
      id: "workflow_activation_consignation",
      taskTypeId: "task_activation",
      activityTypeId: "activity_consignation",
      requiresBeforePhoto: true,
      requiresAfterPhoto: true,
      requiresComment: true,
      requiresSupervisorApproval: false,
      requiresConsignationEmail: true
    }
  ];

  for (const rule of workflowRules) {
    await prisma.workflowRule.upsert({
      where: { id: rule.id },
      create: { ...rule, organizationId: ORGANIZATION_ID },
      update: rule
    });
  }
}

async function seedOperationalRecords({ today, tomorrow, yesterday }) {
  await prisma.agendaEvent.upsert({
    where: { id: "agenda_team_sync_001" },
    create: {
      id: "agenda_team_sync_001",
      organizationId: ORGANIZATION_ID,
      title: "Central route weekly sync",
      description: "Supervisor follow-up for route coverage, client requests, and pending evidence.",
      startAt: `${today}T15:00:00.000Z`,
      endAt: `${today}T16:00:00.000Z`,
      allDay: false,
      scopeType: "team",
      scopeReferenceId: "team_central",
      ownerUserId: "user_supervisor_001",
      teamId: "team_central",
      colorToken: "agenda",
      createdByUserId: "user_admin_001"
    },
    update: {
      startAt: `${today}T15:00:00.000Z`,
      endAt: `${today}T16:00:00.000Z`,
      ownerUserId: "user_supervisor_001",
      teamId: "team_central"
    }
  });

  await prisma.clientRequest.upsert({
    where: { id: "request_caps_001" },
    create: {
      id: "request_caps_001",
      organizationId: ORGANIZATION_ID,
      title: "Replace missing shelf talker",
      description: "Client requested updated material before the next weekend promotion.",
      requesterName: "Auto Mercado trade team",
      requesterEmail: "trade@automercado.example",
      ownerUserId: "user_supervisor_001",
      clientId: "client_auto_mercado",
      provinceId: "province_san_jose",
      cantonId: "canton_escazu",
      districtId: "district_sj_escazu_03",
      zoneId: "zone_sj_default",
      pointOfSaleId: "pos_escazu_001",
      status: "open",
      dueDate: tomorrow,
      openedAt: `${today}T14:30:00.000Z`,
      priority: "high"
    },
    update: { dueDate: tomorrow, status: "open", priority: "high" }
  });

  const tasks = [
    ["task_launch_display", "Install launch display at Escazú Plaza", "Install display, take before/after evidence, and report completion.", today, "pos_escazu_001", "province_san_jose", "canton_escazu", "district_sj_escazu_03", "zone_sj_default", "client_auto_mercado", "activity_exhibition", "task_visit", "pending", "high"],
    ["task_shelf_audit", "Audit shelf presence in Santa Ana", "Capture current shelf state and mark missing materials.", today, "pos_santa_ana_001", "province_san_jose", "canton_santa_ana", "district_sj_santa_ana_03", "zone_sj_default", "client_walmart", "activity_audit", "task_visit", "in_progress", "medium"],
    ["task_completed_evidence", "Complete Belén evidence package", "Upload final evidence document and close the visit.", yesterday, "pos_heredia_001", "province_heredia", "canton_belen", "district_he_belen_01", "zone_he_default", "client_price_smart", "activity_exhibition", "task_visit", "completed", "medium"],
    ["task_cancelled_demo", "Cancelled client training", "Client cancelled the training window.", today, "pos_santa_ana_001", "province_san_jose", "canton_santa_ana", "district_sj_santa_ana_03", "zone_sj_default", "client_walmart", "activity_training", "task_follow_up", "cancelled", "low"],
    ["task_rescheduled_demo", "Rescheduled follow-up visit", "Field user moved the visit to the next available client window.", tomorrow, "pos_escazu_001", "province_san_jose", "canton_escazu", "district_sj_escazu_03", "zone_sj_default", "client_auto_mercado", "activity_consignation", "task_follow_up", "rescheduled", "medium"]
  ].map(([id, title, objective, scheduledFor, pointOfSaleId, provinceId, cantonId, districtId, zoneId, clientId, activityTypeId, taskTypeId, status, priority]) => ({
    id,
    title,
    objective,
    scheduledFor,
    pointOfSaleId,
    provinceId,
    cantonId,
    districtId,
    zoneId,
    clientId,
    activityTypeId,
    taskTypeId,
    status,
    priority
  }));

  for (const task of tasks) {
    await prisma.task.upsert({
      where: { id: task.id },
      create: { ...task, organizationId: ORGANIZATION_ID, requesterId: "user_admin_001", assigneeId: "user_field_001", difficulty: "standard" },
      update: { ...task, requesterId: "user_admin_001", assigneeId: "user_field_001", difficulty: "standard" }
    });

    await prisma.visit.upsert({
      where: { id: `visit_${task.id}` },
      create: visitPayload(task),
      update: visitPayload(task)
    });
  }

  await prisma.mediaAsset.upsert({
    where: { id: "media_before_launch_display" },
    create: {
      id: "media_before_launch_display",
      organizationId: ORGANIZATION_ID,
      uploaderUserId: "user_field_001",
      fileName: "launch-display-before.jpg",
      mimeType: "image/jpeg",
      originalStoragePath: "/mock-storage/originals/launch-display-before.jpg",
      thumbnailStoragePath: "/mock-storage/thumbs/launch-display-before.jpg",
      capturedAt: `${today}T13:40:00.000Z`,
      uploadStatus: "uploaded",
      byteSize: 248000,
      width: 1440,
      height: 1080
    },
    update: { capturedAt: `${today}T13:40:00.000Z`, uploadStatus: "uploaded" }
  });

  await prisma.evidencePhoto.upsert({
    where: { id: "evidence_before_launch_display" },
    create: {
      id: "evidence_before_launch_display",
      organizationId: ORGANIZATION_ID,
      uploaderUserId: "user_field_001",
      taskId: "task_launch_display",
      visitId: "visit_task_launch_display",
      mediaAssetId: "media_before_launch_display",
      type: "before",
      capturedAt: `${today}T13:40:00.000Z`
    },
    update: { capturedAt: `${today}T13:40:00.000Z` }
  });
}

function visitPayload(task) {
  return {
    id: `visit_${task.id}`,
    organizationId: ORGANIZATION_ID,
    taskId: task.id,
    assigneeId: "user_field_001",
    scheduledFor: task.scheduledFor,
    provinceId: task.provinceId,
    cantonId: task.cantonId,
    districtId: task.districtId,
    zoneId: task.zoneId,
    pointOfSaleId: task.pointOfSaleId,
    status: task.status === "completed" ? "checked_out" : task.status === "in_progress" ? "checked_in" : "scheduled",
    checkedInAt: task.status === "completed" || task.status === "in_progress" ? `${task.scheduledFor}T14:00:00.000Z` : null,
    checkedOutAt: task.status === "completed" ? `${task.scheduledFor}T15:00:00.000Z` : null
  };
}

async function seedAdminSettings() {
  await prisma.adminSettings.upsert({
    where: { organizationId: ORGANIZATION_ID },
    create: { organizationId: ORGANIZATION_ID, defaultRecipientEmails: "ops@capris.example", retentionPhotoDays: 365, retentionAuditDays: 730 },
    update: { defaultRecipientEmails: "ops@capris.example", retentionPhotoDays: 365, retentionAuditDays: 730 }
  });
}

async function hashPassword(value) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(value, salt, 64);
  return `scrypt:${salt}:${key.toString("hex")}`;
}

function formatDate(value) {
  return value.toISOString().slice(0, 10);
}

function addDays(value, days) {
  const copy = new Date(value);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
