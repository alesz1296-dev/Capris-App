import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import type {
  CreateClientInput,
  CreatePointOfSaleInput,
  CreateProvinceInput,
  CreateZoneInput,
  UpdateClientInput,
  UpdatePointOfSaleInput,
  UpdateProvinceInput,
  UpdateZoneInput
} from "@capris/shared";
import type {
  CreateActivityTypeInput,
  CreateTaskTypeInput,
  CreateWorkflowRuleInput,
  UpdateActivityTypeInput,
  UpdateTaskTypeInput,
  UpdateWorkflowRuleInput
} from "@capris/shared";
import { RequirePermissions } from "../auth/require-permission.decorator";
import { CatalogsService } from "./catalogs.service";

@Controller("catalogs")
@RequirePermissions("catalogs.manage")
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

  @Get("provinces/:id")
  getProvince(@Param("id") id: string) {
    return this.service.getProvince(id);
  }

  @Post("provinces")
  createProvince(@Body() input: CreateProvinceInput) {
    return this.service.createProvince(input);
  }

  @Patch("provinces/:id")
  updateProvince(@Param("id") id: string, @Body() input: UpdateProvinceInput) {
    return this.service.updateProvince(id, input);
  }

  @Delete("provinces/:id")
  archiveProvince(@Param("id") id: string) {
    return this.service.archiveProvince(id);
  }

  @Get("zones")
  getZones() {
    return this.service.getZones();
  }

  @Get("zones/:id")
  getZone(@Param("id") id: string) {
    return this.service.getZone(id);
  }

  @Post("zones")
  createZone(@Body() input: CreateZoneInput) {
    return this.service.createZone(input);
  }

  @Patch("zones/:id")
  updateZone(@Param("id") id: string, @Body() input: UpdateZoneInput) {
    return this.service.updateZone(id, input);
  }

  @Delete("zones/:id")
  archiveZone(@Param("id") id: string) {
    return this.service.archiveZone(id);
  }

  @Get("clients")
  getClients() {
    return this.service.getClients();
  }

  @Get("clients/:id")
  getClient(@Param("id") id: string) {
    return this.service.getClient(id);
  }

  @Post("clients")
  createClient(@Body() input: CreateClientInput) {
    return this.service.createClient(input);
  }

  @Patch("clients/:id")
  updateClient(@Param("id") id: string, @Body() input: UpdateClientInput) {
    return this.service.updateClient(id, input);
  }

  @Delete("clients/:id")
  archiveClient(@Param("id") id: string) {
    return this.service.archiveClient(id);
  }

  @Get("points-of-sale")
  getPointsOfSale() {
    return this.service.getPointsOfSale();
  }

  @Get("points-of-sale/:id")
  getPointOfSale(@Param("id") id: string) {
    return this.service.getPointOfSale(id);
  }

  @Post("points-of-sale")
  createPointOfSale(@Body() input: CreatePointOfSaleInput) {
    return this.service.createPointOfSale(input);
  }

  @Patch("points-of-sale/:id")
  updatePointOfSale(@Param("id") id: string, @Body() input: UpdatePointOfSaleInput) {
    return this.service.updatePointOfSale(id, input);
  }

  @Delete("points-of-sale/:id")
  archivePointOfSale(@Param("id") id: string) {
    return this.service.archivePointOfSale(id);
  }

  @Get("activity-types")
  getActivityTypes() {
    return this.service.getActivityTypes();
  }

  @Get("activity-types/:id")
  getActivityType(@Param("id") id: string) {
    return this.service.getActivityType(id);
  }

  @Post("activity-types")
  createActivityType(@Body() input: CreateActivityTypeInput) {
    return this.service.createActivityType(input);
  }

  @Patch("activity-types/:id")
  updateActivityType(@Param("id") id: string, @Body() input: UpdateActivityTypeInput) {
    return this.service.updateActivityType(id, input);
  }

  @Delete("activity-types/:id")
  archiveActivityType(@Param("id") id: string) {
    return this.service.archiveActivityType(id);
  }

  @Get("task-types")
  getTaskTypes() {
    return this.service.getTaskTypes();
  }

  @Get("task-types/:id")
  getTaskType(@Param("id") id: string) {
    return this.service.getTaskType(id);
  }

  @Post("task-types")
  createTaskType(@Body() input: CreateTaskTypeInput) {
    return this.service.createTaskType(input);
  }

  @Patch("task-types/:id")
  updateTaskType(@Param("id") id: string, @Body() input: UpdateTaskTypeInput) {
    return this.service.updateTaskType(id, input);
  }

  @Delete("task-types/:id")
  archiveTaskType(@Param("id") id: string) {
    return this.service.archiveTaskType(id);
  }

  @Get("workflow-rules")
  getWorkflowRules() {
    return this.service.getWorkflowRules();
  }

  @Get("workflow-rules/:id")
  getWorkflowRule(@Param("id") id: string) {
    return this.service.getWorkflowRule(id);
  }

  @Post("workflow-rules")
  createWorkflowRule(@Body() input: CreateWorkflowRuleInput) {
    return this.service.createWorkflowRule(input);
  }

  @Patch("workflow-rules/:id")
  updateWorkflowRule(@Param("id") id: string, @Body() input: UpdateWorkflowRuleInput) {
    return this.service.updateWorkflowRule(id, input);
  }

  @Delete("workflow-rules/:id")
  archiveWorkflowRule(@Param("id") id: string) {
    return this.service.archiveWorkflowRule(id);
  }
}
