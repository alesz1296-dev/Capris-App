import { BadRequestException, Body, Controller, Get, Header, Param, Post, Query, Req } from "@nestjs/common";
import { ZodError } from "zod";
import {
  createReportSnapshotSchema,
  reportFiltersSchema,
  type CreateReportSnapshotInput,
  type Locale,
  type ReportFilters
} from "@capris/shared";
import type { AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { RequirePermissions } from "../auth/require-permission.decorator";
import { FieldOperationsService } from "./field-operations.service";

@Controller()
export class FieldOperationsController {
  constructor(private readonly service: FieldOperationsService) {}

  @Get("bootstrap")
  bootstrap(@Query("locale") locale: Locale = "en") {
    return this.service.getBootstrap(locale);
  }

  @Get("dashboard")
  @RequirePermissions("dashboards.view")
  dashboard(@Query("locale") locale: Locale = "en", @Req() request?: AuthenticatedRequest) {
    return this.service.getDashboard(locale, request?.auth);
  }

  @Get("reports/bootstrap")
  @RequirePermissions("reports.export")
  getReportBootstrap(@Query("locale") locale: Locale = "en", @Req() request?: AuthenticatedRequest) {
    return this.service.getReportBootstrap(locale, request?.auth);
  }

  @Get("reports/:name.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @RequirePermissions("reports.export")
  async exportCsv(
    @Param("name") name: string,
    @Query("locale") locale: Locale = "en",
    @Query("userId") userId?: string,
    @Query("zoneId") zoneId?: string,
    @Query("provinceId") provinceId?: string,
    @Query("clientId") clientId?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Req() request?: AuthenticatedRequest
  ) {
    const result = await this.service.exportCsv(
      name,
      locale,
      parseInput(reportFiltersSchema, { userId, zoneId, provinceId, clientId, dateFrom, dateTo }),
      request?.auth
    );
    return result.csv;
  }

  @Get("reports/snapshots")
  @RequirePermissions("reports.export")
  getReportSnapshots(@Req() request?: AuthenticatedRequest) {
    return this.service.getReportSnapshots(request?.auth);
  }

  @Post("reports/snapshots")
  @RequirePermissions("reports.export")
  createReportSnapshot(@Body() input: CreateReportSnapshotInput, @Req() request: AuthenticatedRequest) {
    return this.service.createReportSnapshot(parseInput(createReportSnapshotSchema, input), request.auth);
  }
}

function parseInput<TOutput>(schema: { parse: (input: unknown) => TOutput }, input: unknown): TOutput {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException(error.issues.map((issue) => issue.message).join(" "));
    }
    throw error;
  }
}
