import type { Client, PointOfSale, Province, Zone } from "./domain";

export interface CreateProvinceInput {
  organizationId: string;
  name: string;
  code: string;
  active?: boolean;
}

export interface CreateZoneInput {
  organizationId: string;
  provinceId: string;
  name: string;
  code: string;
  active?: boolean;
}

export interface CreateClientInput {
  organizationId: string;
  name: string;
  code: string;
  contactEmail?: string;
  active?: boolean;
}

export interface CreatePointOfSaleInput {
  organizationId: string;
  provinceId: string;
  zoneId: string;
  clientId: string;
  name: string;
  code: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  active?: boolean;
}

export interface CatalogBootstrap {
  provinces: Province[];
  zones: Zone[];
  clients: Client[];
  pointsOfSale: PointOfSale[];
}

