import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";
import { json, urlencoded, type NextFunction, type Request, type Response } from "express";
import { AppModule } from "./app.module";
import { PrismaService } from "./modules/database/prisma.service";
import { RequestMetricsService, resolveRequestRouteLabel } from "./modules/system-health/request-metrics.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(json({ limit: "25mb" }));
  app.use(urlencoded({ extended: true, limit: "25mb" }));
  app.setGlobalPrefix("api/v1");
  app.enableCors(resolveCorsOptions());
  await app.get(PrismaService).enableShutdownHooks(app);
  const requestMetrics = app.get(RequestMetricsService);
  app.use((request: Request, response: Response, next: NextFunction) => {
    const startedAt = performance.now();
    response.on("finish", () => {
      requestMetrics.recordRequest({
        method: request.method,
        route: resolveRequestRouteLabel(request),
        statusCode: response.statusCode,
        durationMs: performance.now() - startedAt
      });
    });
    next();
  });
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 4000);
}

void bootstrap();

function resolveCorsOptions(): CorsOptions {
  const configuredOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowAllOrigins = process.env.NODE_ENV !== "production" && !configuredOrigins?.length;
  const allowedOrigins = configuredOrigins?.length
    ? configuredOrigins
    : [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001"
      ];

  return {
    origin(origin, callback) {
      if (!origin || allowAllOrigins || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin ${origin} is not allowed.`));
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Requested-With"]
  };
}
