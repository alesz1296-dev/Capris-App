import { INestApplication, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const candidatePaths = [
      path.resolve(process.cwd(), "apps/api/prisma/dev.db"),
      path.resolve(process.cwd(), "prisma/dev.db")
    ];
    const resolvedDbPath = candidatePaths.find((candidate) => fs.existsSync(path.dirname(candidate))) ?? candidatePaths[0];
    const datasourceUrl = resolveDatasourceUrl(resolvedDbPath);

    super({
      datasources: {
        db: {
          url: datasourceUrl
        }
      }
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async enableShutdownHooks(app: INestApplication) {
    let closed = false;

    const closeApp = async () => {
      if (closed) {
        return;
      }

      closed = true;
      await app.close();
    };

    process.once("beforeExit", () => {
      void closeApp();
    });
    process.once("SIGINT", () => {
      void closeApp();
    });
    process.once("SIGTERM", () => {
      void closeApp();
    });
  }
}

function resolveDatasourceUrl(resolvedDbPath: string) {
  const fallbackUrl = `file:${resolvedDbPath.replace(/\\/g, "/")}`;
  const candidateNames = ["DATABASE_URL", "DATABASE_PRIVATE_URL", "DATABASE_PUBLIC_URL", "POSTGRES_URL", "RAILWAY_DATABASE_URL"];
  const candidates = candidateNames
    .map((name) => ({ name, value: process.env[name] }))
    .filter((candidate): candidate is { name: string; value: string } => Boolean(candidate.value));
  const primary = process.env.DATABASE_URL;
  const isProductionLike = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging" || Boolean(process.env.RAILWAY_ENVIRONMENT);
  const primaryIsLocalhost = primary ? isLocalhostDatabaseUrl(primary) : false;
  const railwayCandidate = candidates.find((candidate) => !isLocalhostDatabaseUrl(candidate.value) && candidate.value.startsWith("postgres"));
  const selected = isProductionLike && primaryIsLocalhost && railwayCandidate ? railwayCandidate : candidates[0];
  const datasourceUrl = selected?.value ?? fallbackUrl;

  if (isProductionLike && isLocalhostDatabaseUrl(datasourceUrl)) {
    throw new Error(
      `Refusing to start with a localhost database URL in ${process.env.NODE_ENV ?? "production"} mode. ` +
        `Set DATABASE_URL to the Railway Postgres connection string. Current source: ${selected?.name ?? "fallback"}.`
    );
  }

  return datasourceUrl;
}

function isLocalhostDatabaseUrl(value: string) {
  return value.includes("@localhost:") || value.includes("@127.0.0.1:") || value.includes("@[::1]:");
}
