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
    const datasourceUrl = process.env.DATABASE_URL ?? `file:${resolvedDbPath.replace(/\\/g, "/")}`;

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
