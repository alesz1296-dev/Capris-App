import { Module } from "@nestjs/common";
import { CatalogsModule } from "../catalogs/catalogs.module";
import { IdentityAccessController } from "./identity-access.controller";
import { IdentityAccessService } from "./identity-access.service";

@Module({
  imports: [CatalogsModule],
  controllers: [IdentityAccessController],
  providers: [IdentityAccessService],
  exports: [IdentityAccessService]
})
export class IdentityAccessModule {}
