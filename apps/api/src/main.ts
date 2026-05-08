import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module";
import { PrismaService } from "./modules/database/prisma.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(json({ limit: "25mb" }));
  app.use(urlencoded({ extended: true, limit: "25mb" }));
  app.setGlobalPrefix("api/v1");
  app.enableCors();
  await app.get(PrismaService).enableShutdownHooks(app);
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 4000);
}

void bootstrap();
