import type { Canton, Client, District, PointOfSale, Province, Zone } from "./domain";
import type { ActivityType, TaskType, WorkflowRule } from "./workflow";

export interface CreateProvinceInput {
  organizationId: string;
  name: string;
  code: string;
  active?: boolean;
}

export interface UpdateProvinceInput {
  name?: string;
  code?: string;
  active?: boolean;
}

export interface CreateCantonInput {
  organizationId: string;
  provinceId: string;
  name: string;
  code: string;
  active?: boolean;
}

export interface UpdateCantonInput {
  provinceId?: string;
  name?: string;
  code?: string;
  active?: boolean;
}

export interface CreateDistrictInput {
  organizationId: string;
  provinceId: string;
  cantonId: string;
  name: string;
  code: string;
  active?: boolean;
}

export interface UpdateDistrictInput {
  provinceId?: string;
  cantonId?: string;
  name?: string;
  code?: string;
  active?: boolean;
}

export interface CreateZoneInput {
  organizationId: string;
  provinceId: string;
  name: string;
  code: string;
  active?: boolean;
}

export interface UpdateZoneInput {
  provinceId?: string;
  name?: string;
  code?: string;
  active?: boolean;
}

export interface CreateClientInput {
  organizationId: string;
  name: string;
  code: string;
  contactEmail?: string;
  active?: boolean;
}

export interface UpdateClientInput {
  name?: string;
  code?: string;
  contactEmail?: string;
  active?: boolean;
}

export interface CreatePointOfSaleInput {
  organizationId: string;
  provinceId: string;
  cantonId?: string;
  districtId?: string;
  zoneId: string;
  clientId: string;
  name: string;
  code: string;
  address?: string;
  active?: boolean;
}

export interface UpdatePointOfSaleInput {
  provinceId?: string;
  cantonId?: string;
  districtId?: string;
  zoneId?: string;
  clientId?: string;
  name?: string;
  code?: string;
  address?: string;
  active?: boolean;
}

export interface CatalogBootstrap {
  provinces: Province[];
  cantons: Canton[];
  districts: District[];
  zones: Zone[];
  clients: Client[];
  pointsOfSale: PointOfSale[];
  activityTypes: ActivityType[];
  taskTypes: TaskType[];
  workflowRules: WorkflowRule[];
}

export interface CatalogMutationResult<T> {
  item: T;
  message: string;
}
