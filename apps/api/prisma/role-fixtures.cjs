if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set before creating role fixtures.");
}

const { PrismaClient } = require("@prisma/client");
const { randomBytes, scrypt: scryptCallback } = require("node:crypto");
const { promisify } = require("node:util");

const scrypt = promisify(scryptCallback);
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

const defaultPassword = "CaprisLocal123!";
const password = process.env.CAPRIS_QA_PASSWORD ?? defaultPassword;

if (process.env.NODE_ENV === "production" && !process.env.CAPRIS_QA_PASSWORD) {
  throw new Error("Refusing to create production role fixtures without CAPRIS_QA_PASSWORD.");
}

async function hashPassword(value) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(value, salt, 64);
  return `scrypt:${salt}:${key.toString("hex")}`;
}

async function main() {
  await prisma.organization.upsert({
    where: { id: "org_capris" },
    create: {
      id: "org_capris",
      name: "Capris Costa Rica",
      defaultLocale: "es",
      timezone: "America/Costa_Rica",
      active: true
    },
    update: {
      active: true
    }
  });

  const passwordHash = await hashPassword(password);
  const users = [
    {
      id: "user_admin_001",
      name: "Maria Solis",
      email: "maria.solis@capris.example",
      role: "admin",
      locale: "es"
    },
    {
      id: "user_supervisor_001",
      name: "Daniel Rojas",
      email: "daniel.rojas@capris.example",
      role: "supervisor",
      locale: "es"
    },
    {
      id: "user_field_001",
      name: "Lucia Vargas",
      email: "lucia.vargas@capris.example",
      role: "field_user",
      locale: "es"
    }
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      create: {
        ...user,
        organizationId: "org_capris",
        passwordHash,
        active: true
      },
      update: {
        id: user.id,
        organizationId: "org_capris",
        name: user.name,
        role: user.role,
        locale: user.locale,
        passwordHash,
        active: true
      }
    });
  }

  await prisma.team.upsert({
    where: { id: "team_central" },
    create: {
      id: "team_central",
      organizationId: "org_capris",
      name: "Central Route Team",
      leadUserId: "user_supervisor_001",
      active: true
    },
    update: {
      leadUserId: "user_supervisor_001",
      active: true
    }
  });

  await prisma.supervisorScope.upsert({
    where: { id: "scope_org_capris" },
    create: {
      id: "scope_org_capris",
      organizationId: "org_capris",
      userId: "user_supervisor_001",
      type: "organization",
      referenceId: "org_capris",
      referenceName: "Capris Costa Rica",
      active: true
    },
    update: {
      userId: "user_supervisor_001",
      type: "organization",
      referenceId: "org_capris",
      referenceName: "Capris Costa Rica",
      active: true
    }
  });

  console.log("Role fixtures ready:");
  for (const user of users) {
    console.log(`- ${user.role}: ${user.email}`);
  }
  if (!process.env.CAPRIS_QA_PASSWORD) {
    console.log("Default local password: CaprisLocal123!");
  }
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
