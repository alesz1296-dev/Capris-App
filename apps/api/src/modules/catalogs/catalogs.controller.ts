import { Body, Controller, Get, Post } from "@nestjs/common";
import type {
  CreateClientInput,
  CreatePointOfSaleInput,
  CreateProvinceInput,
  CreateZoneInput
} from "@capris/shared";
import { CatalogsService } from "./catalogs.service";

@Controller("catalogs")
export class CatalogsController {
  constructor(private readonly service: CatalogsService) {}

  @Get("bootstrap")
  getBootstrap() {
    return this.service.getCatalogBootstrap();
  }

  @Get("provinces")
  getProvinces() {
    return this.service.getProvinces();
  }

  @Post("provinces")
  createProvince(@Body() input: CreateProvinceInput) {
    return this.service.createProvince(input);
  }

  @Get("zones")
  getZones() {
    return this.service.getZones();
  }

  @Post("zones")
  createZone(@Body() input: CreateZoneInput) {
    return this.service.createZone(input);
  }

  @Get("clients")
  getClients() {
    return this.service.getClients();
  }

  @Post("clients")
  createClient(@Body() input: CreateClientInput) {
    return this.service.createClient(input);
  }

  @Get("points-of-sale")
  getPointsOfSale() {
    return this.service.getPointsOfSale();
  }

  @Post("points-of-sale")
  createPointOfSale(@Body() input: CreatePointOfSaleInput) {
    return this.service.createPointOfSale(input);
  }
}

