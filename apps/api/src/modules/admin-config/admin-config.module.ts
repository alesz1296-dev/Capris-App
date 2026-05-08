import { Module } from "@nestjs/common";
import { CatalogsModule } from "../catalogs/catalogs.module";
import { IdentityAccessModule } from "../identity-access/identity-access.module";
import { AdminConfigController } from "./admin-config.controller";
import { AdminConfigService } from "./admin-config.service";

@Module({
  imports: [CatalogsModule, IdentityAccessModule],
  controllers: [AdminConfigController],
  providers: [AdminConfigService]
})
export class AdminConfigModule {}
