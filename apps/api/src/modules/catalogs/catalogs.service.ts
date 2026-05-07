import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  DEFAULT_COUNTRY,
  type CatalogBootstrap,
  type Client,
  type CreateClientInput,
  type CreatePointOfSaleInput,
  type CreateProvinceInput,
  type CreateZoneInput,
  type PointOfSale,
  type Province,
  type Zone
} from "@capris/shared";

@Injectable()
export class CatalogsService {
  private readonly provinces: Province[] = [
    {
      id: "province_san_jose",
      organizationId: "org_capris",
      country: DEFAULT_COUNTRY,
      name: "San Jose",
      code: "SJ",
      active: true
    },
    {
      id: "province_alajuela",
      organizationId: "org_capris",
      country: DEFAULT_COUNTRY,
      name: "Alajuela",
      code: "AL",
      active: true
    }
  ];

  private readonly zones: Zone[] = [
    {
      id: "zone_central",
      organizationId: "org_capris",
      provinceId: "province_san_jose",
      name: "Central",
      code: "CENTRAL",
      active: true
    },
    {
      id: "zone_west",
      organizationId: "org_capris",
      provinceId: "province_alajuela",
      name: "West",
      code: "WEST",
      active: true
    }
  ];

  private readonly clients: Client[] = [
    {
      id: "client_auto_mercado",
      organizationId: "org_capris",
      name: "Auto Mercado",
      code: "AUTOMERCADO",
      contactEmail: "trade@automercado.example",
      active: true
    },
    {
      id: "client_walmart",
      organizationId: "org_capris",
      name: "Walmart",
      code: "WALMART",
      contactEmail: "ops@walmart.example",
      active: true
    }
  ];

  private readonly pointsOfSale: PointOfSale[] = [
    {
      id: "pos_escazu_001",
      organizationId: "org_capris",
      provinceId: "province_san_jose",
      zoneId: "zone_central",
      clientId: "client_auto_mercado",
      name: "Escazu Plaza",
      code: "ESCAZU-001",
      address: "Escazu, San Jose",
      latitude: 9.9186,
      longitude: -84.1397,
      active: true
    }
  ];

  getCatalogBootstrap(): CatalogBootstrap {
    return {
      provinces: this.getProvinces(),
      zones: this.getZones(),
      clients: this.getClients(),
      pointsOfSale: this.getPointsOfSale()
    };
  }

  getProvinces() {
    return this.provinces;
  }

  createProvince(input: CreateProvinceInput) {
    this.assertRequiredString(input.organizationId, "organizationId");
    this.assertRequiredString(input.name, "name");
    this.assertRequiredString(input.code, "code");

    const normalizedCode = input.code.trim().toUpperCase();
    this.assertUniqueCode(this.provinces, input.organizationId, normalizedCode, "Province");

    const province: Province = {
      id: this.createId("province"),
      organizationId: input.organizationId,
      country: DEFAULT_COUNTRY,
      name: input.name.trim(),
      code: normalizedCode,
      active: input.active ?? true
    };

    this.provinces.push(province);
    return province;
  }

  getZones() {
    return this.zones;
  }

  createZone(input: CreateZoneInput) {
    this.assertRequiredString(input.organizationId, "organizationId");
    this.assertRequiredString(input.provinceId, "provinceId");
    this.assertRequiredString(input.name, "name");
    this.assertRequiredString(input.code, "code");

    const province = this.provinces.find(
      (entry) => entry.id === input.provinceId && entry.organizationId === input.organizationId
    );

    if (!province) {
      throw new NotFoundException(`Province ${input.provinceId} was not found.`);
    }

    const normalizedCode = input.code.trim().toUpperCase();
    this.assertUniqueCode(this.zones, input.organizationId, normalizedCode, "Zone");

    const zone: Zone = {
      id: this.createId("zone"),
      organizationId: input.organizationId,
      provinceId: input.provinceId,
      name: input.name.trim(),
      code: normalizedCode,
      active: input.active ?? true
    };

    this.zones.push(zone);
    return zone;
  }

  getClients() {
    return this.clients;
  }

  createClient(input: CreateClientInput) {
    this.assertRequiredString(input.organizationId, "organizationId");
    this.assertRequiredString(input.name, "name");
    this.assertRequiredString(input.code, "code");

    const normalizedCode = input.code.trim().toUpperCase();
    this.assertUniqueCode(this.clients, input.organizationId, normalizedCode, "Client");

    const client: Client = {
      id: this.createId("client"),
      organizationId: input.organizationId,
      name: input.name.trim(),
      code: normalizedCode,
      contactEmail: input.contactEmail?.trim() || undefined,
      active: input.active ?? true
    };

    this.clients.push(client);
    return client;
  }

  getPointsOfSale() {
    return this.pointsOfSale;
  }

  createPointOfSale(input: CreatePointOfSaleInput) {
    this.assertRequiredString(input.organizationId, "organizationId");
    this.assertRequiredString(input.provinceId, "provinceId");
    this.assertRequiredString(input.zoneId, "zoneId");
    this.assertRequiredString(input.clientId, "clientId");
    this.assertRequiredString(input.name, "name");
    this.assertRequiredString(input.code, "code");

    const province = this.provinces.find(
      (entry) => entry.id === input.provinceId && entry.organizationId === input.organizationId
    );
    if (!province) {
      throw new NotFoundException(`Province ${input.provinceId} was not found.`);
    }

    const zone = this.zones.find(
      (entry) =>
        entry.id === input.zoneId &&
        entry.organizationId === input.organizationId &&
        entry.provinceId === input.provinceId
    );
    if (!zone) {
      throw new NotFoundException(`Zone ${input.zoneId} was not found in province ${input.provinceId}.`);
    }

    const client = this.clients.find(
      (entry) => entry.id === input.clientId && entry.organizationId === input.organizationId
    );
    if (!client) {
      throw new NotFoundException(`Client ${input.clientId} was not found.`);
    }

    const normalizedCode = input.code.trim().toUpperCase();
    this.assertUniqueCode(this.pointsOfSale, input.organizationId, normalizedCode, "Point of sale");

    const pointOfSale: PointOfSale = {
      id: this.createId("pos"),
      organizationId: input.organizationId,
      provinceId: input.provinceId,
      zoneId: input.zoneId,
      clientId: input.clientId,
      name: input.name.trim(),
      code: normalizedCode,
      address: input.address?.trim() || undefined,
      latitude: input.latitude,
      longitude: input.longitude,
      active: input.active ?? true
    };

    this.pointsOfSale.push(pointOfSale);
    return pointOfSale;
  }

  private assertRequiredString(value: string, fieldName: string) {
    if (!value || !value.trim()) {
      throw new BadRequestException(`${fieldName} is required.`);
    }
  }

  private assertUniqueCode<T extends { organizationId: string; code: string }>(
    collection: T[],
    organizationId: string,
    code: string,
    entityName: string
  ) {
    if (collection.some((entry) => entry.organizationId === organizationId && entry.code === code)) {
      throw new BadRequestException(`${entityName} code ${code} already exists in organization ${organizationId}.`);
    }
  }

  private createId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

