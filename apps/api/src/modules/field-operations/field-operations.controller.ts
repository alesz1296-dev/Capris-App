import { Controller, Get, Header, Param, Query } from "@nestjs/common";
import type { Locale } from "@capris/shared";
import { FieldOperationsService } from "./field-operations.service";

@Controller()
export class FieldOperationsController {
  constructor(private readonly service: FieldOperationsService) {}

  @Get("bootstrap")
  bootstrap(@Query("locale") locale: Locale = "en") {
    return this.service.getBootstrap(locale);
  }

  @Get("dashboard")
  dashboard() {
    return this.service.getDashboard();
  }

  @Get("reports/:name.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  exportCsv(@Param("name") name: string, @Query("locale") locale: Locale = "en") {
    return this.service.exportCsv(name, locale);
  }
}
