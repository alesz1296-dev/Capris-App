import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  type ActivityType,
  type Canton,
  type CatalogBootstrap,
  type CatalogMutationResult,
  type Client,
  type CreateActivityTypeInput,
  type CreateCantonInput,
  type CreateClientInput,
  type CreateDistrictInput,
  type CreatePointOfSaleInput,
  type CreateProvinceInput,
  type CreateTaskTypeInput,
  type CreateWorkflowRuleInput,
  type CreateZoneInput,
  type District,
  DEFAULT_COUNTRY,
  type PointOfSale,
  type Province,
  type TaskType,
  type UpdateActivityTypeInput,
  type UpdateCantonInput,
  type UpdateClientInput,
  type UpdateDistrictInput,
  type UpdatePointOfSaleInput,
  type UpdateProvinceInput,
  type UpdateTaskTypeInput,
  type UpdateWorkflowRuleInput,
  type UpdateZoneInput,
  type WorkflowRule,
  type Zone
} from "@capris/shared";
import { DEFAULT_FIELD_WORKFLOW_RULE } from "@capris/shared";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class CatalogsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCatalogBootstrap(): Promise<CatalogBootstrap> {
    const [provinces, cantons, districts, zones, clients, pointsOfSale, activityTypes, taskTypes, workflowRules] = await Promise.all([
      this.getProvinces(),
      this.getCantons(),
      this.getDistricts(),
      this.getZones(),
      this.getClients(),
      this.getPointsOfSale(),
      this.getActivityTypes(),
      this.getTaskTypes(),
      this.getWorkflowRules()
    ]);

    return {
      provinces,
      cantons,
      districts,
      zones,
      clients,
      pointsOfSale,
      activityTypes,
      taskTypes,
      workflowRules
    };
  }

  async getProvinces(): Promise<Province[]> {
    const provinces = await this.prisma.province.findMany({ orderBy: { name: "asc" } });
    return provinces.map((province: any) => ({
      id: province.id,
      organizationId: province.organizationId,
      country: province.country as typeof DEFAULT_COUNTRY,
      name: province.name,
      code: province.code,
      active: province.active
    }));
  }

  async getProvince(id: string): Promise<Province> {
    return this.toProvince(await this.findProvince(id));
  }

  async createProvince(input: CreateProvinceInput): Promise<Province> {
    this.assertRequiredString(input.organizationId, "organizationId");
    this.assertRequiredString(input.name, "name");
    this.assertRequiredString(input.code, "code");

    const normalizedCode = input.code.trim().toUpperCase();
    await this.assertUniqueCode(this.prisma.province, input.organizationId, normalizedCode, "Province");

    const province = await this.prisma.province.create({
      data: {
        id: this.createId("province"),
        organizationId: input.organizationId,
        country: DEFAULT_COUNTRY,
        name: input.name.trim(),
        code: normalizedCode,
        active: input.active ?? true
      }
    });

    return this.toProvince(province);
  }

  async updateProvince(id: string, input: UpdateProvinceInput): Promise<CatalogMutationResult<Province>> {
    const province = await this.findProvince(id);
    const nextCode = input.code ? input.code.trim().toUpperCase() : province.code;

    if (input.code !== undefined) {
      this.assertRequiredString(input.code, "code");
      await this.assertUniqueCode(this.prisma.province, province.organizationId, nextCode, "Province", province.id);
    }

    if (input.active === false) {
      await this.assertNoActiveZonesForProvince(province.id);
    }

    const updated = await this.prisma.province.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        code: input.code !== undefined ? nextCode : undefined,
        active: input.active
      }
    });

    return {
      item: this.toProvince(updated),
      message: `Province ${updated.id} updated.`
    };
  }

  async archiveProvince(id: string): Promise<CatalogMutationResult<Province>> {
    await this.assertNoActiveZonesForProvince(id);
    const province = await this.prisma.province.update({
      where: { id },
      data: { active: false }
    });

    return {
      item: this.toProvince(province),
      message: `Province ${province.id} archived.`
    };
  }

  async getCantons(): Promise<Canton[]> {
    const cantons = await this.prisma.canton.findMany({ orderBy: [{ provinceId: "asc" }, { name: "asc" }] });
    return cantons.map((canton: any) => this.toCanton(canton));
  }

  async getCanton(id: string): Promise<Canton> {
    return this.toCanton(await this.findCanton(id));
  }

  async createCanton(input: CreateCantonInput): Promise<Canton> {
    this.assertRequiredString(input.organizationId, "organizationId");
    this.assertRequiredString(input.provinceId, "provinceId");
    this.assertRequiredString(input.name, "name");
    this.assertRequiredString(input.code, "code");
    await this.assertProvinceInOrganization(input.provinceId, input.organizationId);

    const normalizedCode = input.code.trim().toUpperCase();
    await this.assertUniqueCode(this.prisma.canton, input.organizationId, normalizedCode, "Canton");

    const canton = await this.prisma.canton.create({
      data: {
        id: this.createId("canton"),
        organizationId: input.organizationId,
        provinceId: input.provinceId,
        name: input.name.trim(),
        code: normalizedCode,
        active: input.active ?? true
      }
    });

    return this.toCanton(canton);
  }

  async updateCanton(id: string, input: UpdateCantonInput): Promise<CatalogMutationResult<Canton>> {
    const canton = await this.findCanton(id);
    const nextProvinceId = input.provinceId ?? canton.provinceId;
    const nextCode = input.code ? input.code.trim().toUpperCase() : canton.code;
    await this.assertProvinceInOrganization(nextProvinceId, canton.organizationId);

    if (input.code !== undefined) {
      this.assertRequiredString(input.code, "code");
      await this.assertUniqueCode(this.prisma.canton, canton.organizationId, nextCode, "Canton", canton.id);
    }

    if (input.active === false) {
      await this.assertNoActiveDistrictsForCanton(canton.id);
    }

    const updated = await this.prisma.canton.update({
      where: { id },
      data: {
        provinceId: nextProvinceId,
        name: input.name?.trim(),
        code: input.code !== undefined ? nextCode : undefined,
        active: input.active
      }
    });

    return { item: this.toCanton(updated), message: `Canton ${updated.id} updated.` };
  }

  async archiveCanton(id: string): Promise<CatalogMutationResult<Canton>> {
    await this.assertNoActiveDistrictsForCanton(id);
    const canton = await this.prisma.canton.update({ where: { id }, data: { active: false } });
    return { item: this.toCanton(canton), message: `Canton ${canton.id} archived.` };
  }

  async getDistricts(): Promise<District[]> {
    const districts = await this.prisma.district.findMany({ orderBy: [{ provinceId: "asc" }, { cantonId: "asc" }, { name: "asc" }] });
    return districts.map((district: any) => this.toDistrict(district));
  }

  async getDistrict(id: string): Promise<District> {
    return this.toDistrict(await this.findDistrict(id));
  }

  async createDistrict(input: CreateDistrictInput): Promise<District> {
    this.assertRequiredString(input.organizationId, "organizationId");
    this.assertRequiredString(input.provinceId, "provinceId");
    this.assertRequiredString(input.cantonId, "cantonId");
    this.assertRequiredString(input.name, "name");
    this.assertRequiredString(input.code, "code");
    await this.assertCantonInProvince(input.cantonId, input.provinceId, input.organizationId);

    const normalizedCode = input.code.trim().toUpperCase();
    await this.assertUniqueCode(this.prisma.district, input.organizationId, normalizedCode, "District");

    const district = await this.prisma.district.create({
      data: {
        id: this.createId("district"),
        organizationId: input.organizationId,
        provinceId: input.provinceId,
        cantonId: input.cantonId,
        name: input.name.trim(),
        code: normalizedCode,
        active: input.active ?? true
      }
    });

    return this.toDistrict(district);
  }

  async updateDistrict(id: string, input: UpdateDistrictInput): Promise<CatalogMutationResult<District>> {
    const district = await this.findDistrict(id);
    const nextProvinceId = input.provinceId ?? district.provinceId;
    const nextCantonId = input.cantonId ?? district.cantonId;
    const nextCode = input.code ? input.code.trim().toUpperCase() : district.code;
    await this.assertCantonInProvince(nextCantonId, nextProvinceId, district.organizationId);

    if (input.code !== undefined) {
      this.assertRequiredString(input.code, "code");
      await this.assertUniqueCode(this.prisma.district, district.organizationId, nextCode, "District", district.id);
    }

    if (input.active === false) {
      await this.assertNoActivePointsOfSaleForDistrict(district.id);
    }

    const updated = await this.prisma.district.update({
      where: { id },
      data: {
        provinceId: nextProvinceId,
        cantonId: nextCantonId,
        name: input.name?.trim(),
        code: input.code !== undefined ? nextCode : undefined,
        active: input.active
      }
    });

    return { item: this.toDistrict(updated), message: `District ${updated.id} updated.` };
  }

  async archiveDistrict(id: string): Promise<CatalogMutationResult<District>> {
    await this.assertNoActivePointsOfSaleForDistrict(id);
    const district = await this.prisma.district.update({ where: { id }, data: { active: false } });
    return { item: this.toDistrict(district), message: `District ${district.id} archived.` };
  }

  async getZones(): Promise<Zone[]> {
    const zones = await this.prisma.zone.findMany({ orderBy: { name: "asc" } });
    return zones.map((zone: any) => this.toZone(zone));
  }

  async getZone(id: string): Promise<Zone> {
    return this.toZone(await this.findZone(id));
  }

  async createZone(input: CreateZoneInput): Promise<Zone> {
    this.assertRequiredString(input.organizationId, "organizationId");
    this.assertRequiredString(input.provinceId, "provinceId");
    this.assertRequiredString(input.name, "name");
    this.assertRequiredString(input.code, "code");

    await this.assertProvinceInOrganization(input.provinceId, input.organizationId);

    const normalizedCode = input.code.trim().toUpperCase();
    await this.assertUniqueCode(this.prisma.zone, input.organizationId, normalizedCode, "Zone");

    const zone = await this.prisma.zone.create({
      data: {
        id: this.createId("zone"),
        organizationId: input.organizationId,
        provinceId: input.provinceId,
        name: input.name.trim(),
        code: normalizedCode,
        active: input.active ?? true
      }
    });

    return this.toZone(zone);
  }

  async updateZone(id: string, input: UpdateZoneInput): Promise<CatalogMutationResult<Zone>> {
    const zone = await this.findZone(id);
    const nextProvinceId = input.provinceId ?? zone.provinceId;
    const nextCode = input.code ? input.code.trim().toUpperCase() : zone.code;

    if (input.provinceId !== undefined) {
      await this.assertProvinceInOrganization(nextProvinceId, zone.organizationId);
      if ((await this.hasActivePointsOfSaleForZone(zone.id)) && nextProvinceId !== zone.provinceId) {
        throw new BadRequestException(`Zone ${zone.id} cannot move provinces while active points of sale exist.`);
      }
    }

    if (input.code !== undefined) {
      this.assertRequiredString(input.code, "code");
      await this.assertUniqueCode(this.prisma.zone, zone.organizationId, nextCode, "Zone", zone.id);
    }

    if (input.active === false) {
      await this.assertNoActivePointsOfSaleForZone(zone.id);
    }

    const updated = await this.prisma.zone.update({
      where: { id },
      data: {
        provinceId: nextProvinceId,
        name: input.name?.trim(),
        code: input.code !== undefined ? nextCode : undefined,
        active: input.active
      }
    });

    return {
      item: this.toZone(updated),
      message: `Zone ${updated.id} updated.`
    };
  }

  async archiveZone(id: string): Promise<CatalogMutationResult<Zone>> {
    await this.assertNoActivePointsOfSaleForZone(id);
    const zone = await this.prisma.zone.update({
      where: { id },
      data: { active: false }
    });

    return {
      item: this.toZone(zone),
      message: `Zone ${zone.id} archived.`
    };
  }

  async getClients(): Promise<Client[]> {
    const clients = await this.prisma.client.findMany({ orderBy: { name: "asc" } });
    return clients.map((client: any) => this.toClient(client));
  }

  async getClient(id: string): Promise<Client> {
    return this.toClient(await this.findClient(id));
  }

  async createClient(input: CreateClientInput): Promise<Client> {
    this.assertRequiredString(input.organizationId, "organizationId");
    this.assertRequiredString(input.name, "name");
    this.assertRequiredString(input.code, "code");

    const normalizedCode = input.code.trim().toUpperCase();
    await this.assertUniqueCode(this.prisma.client, input.organizationId, normalizedCode, "Client");

    const client = await this.prisma.client.create({
      data: {
        id: this.createId("client"),
        organizationId: input.organizationId,
        name: input.name.trim(),
        code: normalizedCode,
        contactEmail: input.contactEmail?.trim() || null,
        active: input.active ?? true
      }
    });

    return this.toClient(client);
  }

  async updateClient(id: string, input: UpdateClientInput): Promise<CatalogMutationResult<Client>> {
    const client = await this.findClient(id);
    const nextCode = input.code ? input.code.trim().toUpperCase() : client.code;

    if (input.code !== undefined) {
      this.assertRequiredString(input.code, "code");
      await this.assertUniqueCode(this.prisma.client, client.organizationId, nextCode, "Client", client.id);
    }

    if (input.active === false) {
      await this.assertNoActivePointsOfSaleForClient(client.id);
    }

    const updated = await this.prisma.client.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        code: input.code !== undefined ? nextCode : undefined,
        contactEmail: input.contactEmail !== undefined ? input.contactEmail.trim() || null : undefined,
        active: input.active
      }
    });

    return {
      item: this.toClient(updated),
      message: `Client ${updated.id} updated.`
    };
  }

  async archiveClient(id: string): Promise<CatalogMutationResult<Client>> {
    await this.assertNoActivePointsOfSaleForClient(id);
    const client = await this.prisma.client.update({
      where: { id },
      data: { active: false }
    });

    return {
      item: this.toClient(client),
      message: `Client ${client.id} archived.`
    };
  }

  async getPointsOfSale(): Promise<PointOfSale[]> {
    const pointsOfSale = await this.prisma.pointOfSale.findMany({ orderBy: { name: "asc" } });
    return pointsOfSale.map((pointOfSale: any) => this.toPointOfSale(pointOfSale));
  }

  async getPointOfSale(id: string): Promise<PointOfSale> {
    return this.toPointOfSale(await this.findPointOfSale(id));
  }

  async createPointOfSale(input: CreatePointOfSaleInput): Promise<PointOfSale> {
    this.assertRequiredString(input.organizationId, "organizationId");
    this.assertRequiredString(input.provinceId, "provinceId");
    this.assertRequiredString(input.zoneId, "zoneId");
    this.assertRequiredString(input.clientId, "clientId");
    this.assertRequiredString(input.name, "name");
    this.assertRequiredString(input.code, "code");

    await this.assertProvinceInOrganization(input.provinceId, input.organizationId);
    if (input.cantonId) {
      await this.assertCantonInProvince(input.cantonId, input.provinceId, input.organizationId);
    }
    if (input.districtId) {
      await this.assertDistrictInCanton(input.districtId, input.cantonId, input.provinceId, input.organizationId);
    }
    await this.assertZoneInProvince(input.zoneId, input.provinceId, input.organizationId);
    await this.assertClientInOrganization(input.clientId, input.organizationId);

    const normalizedCode = input.code.trim().toUpperCase();
    await this.assertUniqueCode(this.prisma.pointOfSale, input.organizationId, normalizedCode, "Point of sale");

    const pointOfSale = await this.prisma.pointOfSale.create({
      data: {
        id: this.createId("pos"),
        organizationId: input.organizationId,
        provinceId: input.provinceId,
        cantonId: input.cantonId ?? null,
        districtId: input.districtId ?? null,
        zoneId: input.zoneId,
        clientId: input.clientId,
        name: input.name.trim(),
        code: normalizedCode,
        address: input.address?.trim() || null,
        active: input.active ?? true
      }
    });

    return this.toPointOfSale(pointOfSale);
  }

  async updatePointOfSale(id: string, input: UpdatePointOfSaleInput): Promise<CatalogMutationResult<PointOfSale>> {
    const pointOfSale = await this.findPointOfSale(id);
    const nextProvinceId = input.provinceId ?? pointOfSale.provinceId;
    const nextCantonId = input.cantonId === undefined ? pointOfSale.cantonId ?? undefined : input.cantonId;
    const nextDistrictId = input.districtId === undefined ? pointOfSale.districtId ?? undefined : input.districtId;
    const nextZoneId = input.zoneId ?? pointOfSale.zoneId;
    const nextClientId = input.clientId ?? pointOfSale.clientId;
    const nextCode = input.code ? input.code.trim().toUpperCase() : pointOfSale.code;

    await this.assertProvinceInOrganization(nextProvinceId, pointOfSale.organizationId);
    if (nextCantonId) {
      await this.assertCantonInProvince(nextCantonId, nextProvinceId, pointOfSale.organizationId);
    }
    if (nextDistrictId) {
      await this.assertDistrictInCanton(nextDistrictId, nextCantonId, nextProvinceId, pointOfSale.organizationId);
    }
    await this.assertZoneInProvince(nextZoneId, nextProvinceId, pointOfSale.organizationId);
    await this.assertClientInOrganization(nextClientId, pointOfSale.organizationId);

    if (input.code !== undefined) {
      this.assertRequiredString(input.code, "code");
      await this.assertUniqueCode(
        this.prisma.pointOfSale,
        pointOfSale.organizationId,
        nextCode,
        "Point of sale",
        pointOfSale.id
      );
    }

    const updated = await this.prisma.pointOfSale.update({
      where: { id },
      data: {
        provinceId: nextProvinceId,
        cantonId: nextCantonId ?? null,
        districtId: nextDistrictId ?? null,
        zoneId: nextZoneId,
        clientId: nextClientId,
        name: input.name?.trim(),
        code: input.code !== undefined ? nextCode : undefined,
        address: input.address !== undefined ? input.address.trim() || null : undefined,
        active: input.active
      }
    });

    return {
      item: this.toPointOfSale(updated),
      message: `Point of sale ${updated.id} updated.`
    };
  }

  async archivePointOfSale(id: string): Promise<CatalogMutationResult<PointOfSale>> {
    const pointOfSale = await this.prisma.pointOfSale.update({
      where: { id },
      data: { active: false }
    });

    return {
      item: this.toPointOfSale(pointOfSale),
      message: `Point of sale ${pointOfSale.id} archived.`
    };
  }

  async getActivityTypes(): Promise<ActivityType[]> {
    const activityTypes = await this.prisma.activityType.findMany({ orderBy: { name: "asc" } });
    return activityTypes.map((activityType: any) => this.toActivityType(activityType));
  }

  async getActivityType(id: string): Promise<ActivityType> {
    return this.toActivityType(await this.findActivityType(id));
  }

  async createActivityType(input: CreateActivityTypeInput): Promise<ActivityType> {
    this.assertRequiredString(input.organizationId, "organizationId");
    this.assertRequiredString(input.name, "name");
    this.assertRequiredString(input.code, "code");

    const normalizedCode = input.code.trim().toUpperCase();
    await this.assertUniqueCode(this.prisma.activityType, input.organizationId, normalizedCode, "Activity type");

    const activityType = await this.prisma.activityType.create({
      data: {
        id: this.createId("activity"),
        organizationId: input.organizationId,
        name: input.name.trim(),
        code: normalizedCode,
        active: input.active ?? true
      }
    });

    return this.toActivityType(activityType);
  }

  async updateActivityType(id: string, input: UpdateActivityTypeInput): Promise<CatalogMutationResult<ActivityType>> {
    const activityType = await this.findActivityType(id);
    const nextCode = input.code ? input.code.trim().toUpperCase() : activityType.code;

    if (input.code !== undefined) {
      this.assertRequiredString(input.code, "code");
      await this.assertUniqueCode(
        this.prisma.activityType,
        activityType.organizationId,
        nextCode,
        "Activity type",
        activityType.id
      );
    }

    if (input.active === false) {
      await this.assertNoWorkflowRulesForActivityType(activityType.id);
    }

    const updated = await this.prisma.activityType.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        code: input.code !== undefined ? nextCode : undefined,
        active: input.active
      }
    });

    return {
      item: this.toActivityType(updated),
      message: `Activity type ${updated.id} updated.`
    };
  }

  async archiveActivityType(id: string): Promise<CatalogMutationResult<ActivityType>> {
    await this.assertNoWorkflowRulesForActivityType(id);
    const activityType = await this.prisma.activityType.update({
      where: { id },
      data: { active: false }
    });

    return {
      item: this.toActivityType(activityType),
      message: `Activity type ${activityType.id} archived.`
    };
  }

  async getTaskTypes(): Promise<TaskType[]> {
    const taskTypes = await this.prisma.taskType.findMany({ orderBy: { name: "asc" } });
    return taskTypes.map((taskType: any) => this.toTaskType(taskType));
  }

  async getTaskType(id: string): Promise<TaskType> {
    return this.toTaskType(await this.findTaskType(id));
  }

  async createTaskType(input: CreateTaskTypeInput): Promise<TaskType> {
    this.assertRequiredString(input.organizationId, "organizationId");
    this.assertRequiredString(input.name, "name");
    this.assertRequiredString(input.code, "code");

    const normalizedCode = input.code.trim().toUpperCase();
    await this.assertUniqueCode(this.prisma.taskType, input.organizationId, normalizedCode, "Task type");

    const taskType = await this.prisma.taskType.create({
      data: {
        id: this.createId("tasktype"),
        organizationId: input.organizationId,
        name: input.name.trim(),
        code: normalizedCode,
        active: input.active ?? true
      }
    });

    return this.toTaskType(taskType);
  }

  async updateTaskType(id: string, input: UpdateTaskTypeInput): Promise<CatalogMutationResult<TaskType>> {
    const taskType = await this.findTaskType(id);
    const nextCode = input.code ? input.code.trim().toUpperCase() : taskType.code;

    if (input.code !== undefined) {
      this.assertRequiredString(input.code, "code");
      await this.assertUniqueCode(this.prisma.taskType, taskType.organizationId, nextCode, "Task type", taskType.id);
    }

    if (input.active === false) {
      await this.assertNoWorkflowRulesForTaskType(taskType.id);
    }

    const updated = await this.prisma.taskType.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        code: input.code !== undefined ? nextCode : undefined,
        active: input.active
      }
    });

    return {
      item: this.toTaskType(updated),
      message: `Task type ${updated.id} updated.`
    };
  }

  async archiveTaskType(id: string): Promise<CatalogMutationResult<TaskType>> {
    await this.assertNoWorkflowRulesForTaskType(id);
    const taskType = await this.prisma.taskType.update({
      where: { id },
      data: { active: false }
    });

    return {
      item: this.toTaskType(taskType),
      message: `Task type ${taskType.id} archived.`
    };
  }

  async getWorkflowRules(): Promise<WorkflowRule[]> {
    const workflowRules = await this.prisma.workflowRule.findMany({ orderBy: { id: "asc" } });
    return workflowRules.map((workflowRule: any) => this.toWorkflowRule(workflowRule));
  }

  async getWorkflowRule(id: string): Promise<WorkflowRule> {
    return this.toWorkflowRule(await this.findWorkflowRule(id));
  }

  async createWorkflowRule(input: CreateWorkflowRuleInput): Promise<WorkflowRule> {
    this.assertRequiredString(input.organizationId, "organizationId");
    await this.assertWorkflowReferences(input.organizationId, input.taskTypeId, input.activityTypeId);

    const workflowRule = await this.prisma.workflowRule.create({
      data: {
        id: this.createId("workflow"),
        organizationId: input.organizationId,
        taskTypeId: input.taskTypeId,
        activityTypeId: input.activityTypeId,
        requiresBeforePhoto: input.requiresBeforePhoto ?? DEFAULT_FIELD_WORKFLOW_RULE.requiresBeforePhoto,
        requiresAfterPhoto: input.requiresAfterPhoto ?? DEFAULT_FIELD_WORKFLOW_RULE.requiresAfterPhoto,
        requiresComment: input.requiresComment ?? DEFAULT_FIELD_WORKFLOW_RULE.requiresComment,
        requiresSupervisorApproval:
          input.requiresSupervisorApproval ?? DEFAULT_FIELD_WORKFLOW_RULE.requiresSupervisorApproval,
        requiresConsignationEmail:
          input.requiresConsignationEmail ?? DEFAULT_FIELD_WORKFLOW_RULE.requiresConsignationEmail
      }
    });

    return this.toWorkflowRule(workflowRule);
  }

  async updateWorkflowRule(id: string, input: UpdateWorkflowRuleInput): Promise<CatalogMutationResult<WorkflowRule>> {
    const workflowRule = await this.findWorkflowRule(id);
    const nextTaskTypeId = input.taskTypeId !== undefined ? input.taskTypeId : workflowRule.taskTypeId ?? undefined;
    const nextActivityTypeId =
      input.activityTypeId !== undefined ? input.activityTypeId : workflowRule.activityTypeId ?? undefined;

    await this.assertWorkflowReferences(workflowRule.organizationId, nextTaskTypeId, nextActivityTypeId);

    const updated = await this.prisma.workflowRule.update({
      where: { id },
      data: {
        taskTypeId: nextTaskTypeId ?? null,
        activityTypeId: nextActivityTypeId ?? null,
        requiresBeforePhoto: input.requiresBeforePhoto,
        requiresAfterPhoto: input.requiresAfterPhoto,
        requiresComment: input.requiresComment,
        requiresSupervisorApproval: input.requiresSupervisorApproval,
        requiresConsignationEmail: input.requiresConsignationEmail
      }
    });

    return {
      item: this.toWorkflowRule(updated),
      message: `Workflow rule ${updated.id} updated.`
    };
  }

  async archiveWorkflowRule(id: string): Promise<CatalogMutationResult<WorkflowRule>> {
    const workflowRule = await this.prisma.workflowRule.delete({ where: { id } });
    return {
      item: this.toWorkflowRule(workflowRule),
      message: `Workflow rule ${workflowRule.id} archived.`
    };
  }

  private assertRequiredString(value: string, fieldName: string) {
    if (!value || !value.trim()) {
      throw new BadRequestException(`${fieldName} is required.`);
    }
  }

  private async assertUniqueCode(
    delegate: {
      findFirst: (args: {
        where: { organizationId: string; code: string; id?: { not: string } };
      }) => Promise<{ id: string } | null>;
    },
    organizationId: string,
    code: string,
    entityName: string,
    excludeId?: string
  ) {
    const existing = await delegate.findFirst({
      where: {
        organizationId,
        code,
        id: excludeId ? { not: excludeId } : undefined
      }
    });

    if (existing) {
      throw new BadRequestException(`${entityName} code ${code} already exists in organization ${organizationId}.`);
    }
  }

  private createId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private async findProvince(id: string) {
    const province = await this.prisma.province.findUnique({ where: { id } });
    if (!province) {
      throw new NotFoundException(`Province ${id} was not found.`);
    }
    return province;
  }

  private async findCanton(id: string) {
    const canton = await this.prisma.canton.findUnique({ where: { id } });
    if (!canton) {
      throw new NotFoundException(`Canton ${id} was not found.`);
    }
    return canton;
  }

  private async findDistrict(id: string) {
    const district = await this.prisma.district.findUnique({ where: { id } });
    if (!district) {
      throw new NotFoundException(`District ${id} was not found.`);
    }
    return district;
  }

  private async findZone(id: string) {
    const zone = await this.prisma.zone.findUnique({ where: { id } });
    if (!zone) {
      throw new NotFoundException(`Zone ${id} was not found.`);
    }
    return zone;
  }

  private async findClient(id: string) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) {
      throw new NotFoundException(`Client ${id} was not found.`);
    }
    return client;
  }

  private async findPointOfSale(id: string) {
    const pointOfSale = await this.prisma.pointOfSale.findUnique({ where: { id } });
    if (!pointOfSale) {
      throw new NotFoundException(`Point of sale ${id} was not found.`);
    }
    return pointOfSale;
  }

  private async findActivityType(id: string) {
    const activityType = await this.prisma.activityType.findUnique({ where: { id } });
    if (!activityType) {
      throw new NotFoundException(`Activity type ${id} was not found.`);
    }
    return activityType;
  }

  private async findTaskType(id: string) {
    const taskType = await this.prisma.taskType.findUnique({ where: { id } });
    if (!taskType) {
      throw new NotFoundException(`Task type ${id} was not found.`);
    }
    return taskType;
  }

  private async findWorkflowRule(id: string) {
    const workflowRule = await this.prisma.workflowRule.findUnique({ where: { id } });
    if (!workflowRule) {
      throw new NotFoundException(`Workflow rule ${id} was not found.`);
    }
    return workflowRule;
  }

  private async assertProvinceInOrganization(provinceId: string, organizationId: string) {
    const province = await this.prisma.province.findFirst({
      where: { id: provinceId, organizationId }
    });

    if (!province) {
      throw new NotFoundException(`Province ${provinceId} was not found.`);
    }
  }

  private async assertCantonInProvince(cantonId: string, provinceId: string, organizationId: string) {
    const canton = await this.prisma.canton.findFirst({
      where: { id: cantonId, provinceId, organizationId, active: true }
    });

    if (!canton) {
      throw new NotFoundException(`Canton ${cantonId} was not found in province ${provinceId}.`);
    }
  }

  private async assertDistrictInCanton(districtId: string, cantonId: string | undefined, provinceId: string, organizationId: string) {
    if (!cantonId) {
      throw new BadRequestException("districtId requires cantonId.");
    }

    const district = await this.prisma.district.findFirst({
      where: { id: districtId, cantonId, provinceId, organizationId, active: true }
    });

    if (!district) {
      throw new NotFoundException(`District ${districtId} was not found in canton ${cantonId}.`);
    }
  }

  private async assertZoneInProvince(zoneId: string, provinceId: string, organizationId: string) {
    const zone = await this.prisma.zone.findFirst({
      where: {
        id: zoneId,
        provinceId,
        organizationId
      }
    });

    if (!zone) {
      throw new NotFoundException(`Zone ${zoneId} was not found in province ${provinceId}.`);
    }
  }

  private async assertClientInOrganization(clientId: string, organizationId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, organizationId }
    });

    if (!client) {
      throw new NotFoundException(`Client ${clientId} was not found.`);
    }
  }

  private async hasActivePointsOfSaleForZone(zoneId: string) {
    return (await this.prisma.pointOfSale.count({ where: { zoneId, active: true } })) > 0;
  }

  private async assertNoActiveDistrictsForCanton(cantonId: string) {
    if ((await this.prisma.district.count({ where: { cantonId, active: true } })) > 0) {
      throw new BadRequestException(`Canton ${cantonId} still has active districts.`);
    }
  }

  private async assertNoActivePointsOfSaleForDistrict(districtId: string) {
    if ((await this.prisma.pointOfSale.count({ where: { districtId, active: true } })) > 0) {
      throw new BadRequestException(`District ${districtId} still has active points of sale.`);
    }
  }

  private async assertNoActivePointsOfSaleForZone(zoneId: string) {
    if (await this.hasActivePointsOfSaleForZone(zoneId)) {
      throw new BadRequestException(`Zone ${zoneId} still has active points of sale.`);
    }
  }

  private async assertNoActivePointsOfSaleForClient(clientId: string) {
    if ((await this.prisma.pointOfSale.count({ where: { clientId, active: true } })) > 0) {
      throw new BadRequestException(`Client ${clientId} still has active points of sale.`);
    }
  }

  private async assertNoActiveZonesForProvince(provinceId: string) {
    if ((await this.prisma.zone.count({ where: { provinceId, active: true } })) > 0) {
      throw new BadRequestException(`Province ${provinceId} still has active zones.`);
    }
  }

  private async assertNoWorkflowRulesForActivityType(activityTypeId: string) {
    if ((await this.prisma.workflowRule.count({ where: { activityTypeId } })) > 0) {
      throw new BadRequestException(`Activity type ${activityTypeId} is still referenced by workflow rules.`);
    }
  }

  private async assertNoWorkflowRulesForTaskType(taskTypeId: string) {
    if ((await this.prisma.workflowRule.count({ where: { taskTypeId } })) > 0) {
      throw new BadRequestException(`Task type ${taskTypeId} is still referenced by workflow rules.`);
    }
  }

  private async assertWorkflowReferences(organizationId: string, taskTypeId?: string, activityTypeId?: string) {
    if (taskTypeId) {
      const taskType = await this.prisma.taskType.findFirst({
        where: { id: taskTypeId, organizationId, active: true }
      });

      if (!taskType) {
        throw new NotFoundException(`Task type ${taskTypeId} was not found.`);
      }
    }

    if (activityTypeId) {
      const activityType = await this.prisma.activityType.findFirst({
        where: { id: activityTypeId, organizationId, active: true }
      });

      if (!activityType) {
        throw new NotFoundException(`Activity type ${activityTypeId} was not found.`);
      }
    }
  }

  private toProvince(province: {
    id: string;
    organizationId: string;
    country: string;
    name: string;
    code: string;
    active: boolean;
  }): Province {
    return {
      id: province.id,
      organizationId: province.organizationId,
      country: province.country as typeof DEFAULT_COUNTRY,
      name: province.name,
      code: province.code,
      active: province.active
    };
  }

  private toCanton(canton: {
    id: string;
    organizationId: string;
    provinceId: string;
    name: string;
    code: string;
    active: boolean;
  }): Canton {
    return {
      id: canton.id,
      organizationId: canton.organizationId,
      provinceId: canton.provinceId,
      name: canton.name,
      code: canton.code,
      active: canton.active
    };
  }

  private toDistrict(district: {
    id: string;
    organizationId: string;
    provinceId: string;
    cantonId: string;
    name: string;
    code: string;
    active: boolean;
  }): District {
    return {
      id: district.id,
      organizationId: district.organizationId,
      provinceId: district.provinceId,
      cantonId: district.cantonId,
      name: district.name,
      code: district.code,
      active: district.active
    };
  }

  private toZone(zone: {
    id: string;
    organizationId: string;
    provinceId: string;
    name: string;
    code: string;
    active: boolean;
  }): Zone {
    return {
      id: zone.id,
      organizationId: zone.organizationId,
      provinceId: zone.provinceId,
      name: zone.name,
      code: zone.code,
      active: zone.active
    };
  }

  private toClient(client: {
    id: string;
    organizationId: string;
    name: string;
    code: string;
    contactEmail: string | null;
    active: boolean;
  }): Client {
    return {
      id: client.id,
      organizationId: client.organizationId,
      name: client.name,
      code: client.code,
      contactEmail: client.contactEmail ?? undefined,
      active: client.active
    };
  }

  private toPointOfSale(pointOfSale: {
    id: string;
    organizationId: string;
    provinceId: string;
    cantonId: string | null;
    districtId: string | null;
    zoneId: string;
    clientId: string;
    name: string;
    code: string;
    address: string | null;
    active: boolean;
  }): PointOfSale {
    return {
      id: pointOfSale.id,
      organizationId: pointOfSale.organizationId,
      provinceId: pointOfSale.provinceId,
      cantonId: pointOfSale.cantonId ?? undefined,
      districtId: pointOfSale.districtId ?? undefined,
      zoneId: pointOfSale.zoneId,
      clientId: pointOfSale.clientId,
      name: pointOfSale.name,
      code: pointOfSale.code,
      address: pointOfSale.address ?? undefined,
      active: pointOfSale.active
    };
  }

  private toActivityType(activityType: {
    id: string;
    organizationId: string;
    name: string;
    code: string;
    active: boolean;
  }): ActivityType {
    return {
      id: activityType.id,
      organizationId: activityType.organizationId,
      name: activityType.name,
      code: activityType.code,
      active: activityType.active
    };
  }

  private toTaskType(taskType: {
    id: string;
    organizationId: string;
    name: string;
    code: string;
    active: boolean;
  }): TaskType {
    return {
      id: taskType.id,
      organizationId: taskType.organizationId,
      name: taskType.name,
      code: taskType.code,
      active: taskType.active
    };
  }

  private toWorkflowRule(workflowRule: {
    id: string;
    organizationId: string;
    taskTypeId: string | null;
    activityTypeId: string | null;
    requiresBeforePhoto: boolean;
    requiresAfterPhoto: boolean;
    requiresComment: boolean;
    requiresSupervisorApproval: boolean;
    requiresConsignationEmail: boolean;
  }): WorkflowRule {
    return {
      id: workflowRule.id,
      organizationId: workflowRule.organizationId,
      taskTypeId: workflowRule.taskTypeId ?? undefined,
      activityTypeId: workflowRule.activityTypeId ?? undefined,
      requiresBeforePhoto: workflowRule.requiresBeforePhoto,
      requiresAfterPhoto: workflowRule.requiresAfterPhoto,
      requiresComment: workflowRule.requiresComment,
      requiresSupervisorApproval: workflowRule.requiresSupervisorApproval,
      requiresConsignationEmail: workflowRule.requiresConsignationEmail
    };
  }
}
