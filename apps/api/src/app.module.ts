import { Module } from "@nestjs/common";
import { CatalogsModule } from "./modules/catalogs/catalogs.module";
import { FieldOperationsModule } from "./modules/field-operations/field-operations.module";
import { IdentityAccessModule } from "./modules/identity-access/identity-access.module";
import { SystemHealthModule } from "./modules/system-health/system-health.module";

@Module({
  imports: [CatalogsModule, FieldOperationsModule, IdentityAccessModule, SystemHealthModule]
})
export class AppModule {}
