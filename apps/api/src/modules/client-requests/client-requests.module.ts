import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CatalogsModule } from "../catalogs/catalogs.module";
import { IdentityAccessModule } from "../identity-access/identity-access.module";
import { ClientRequestsController } from "./client-requests.controller";
import { ClientRequestsService } from "./client-requests.service";

@Module({
  imports: [AuthModule, IdentityAccessModule, CatalogsModule],
  controllers: [ClientRequestsController],
  providers: [ClientRequestsService],
  exports: [ClientRequestsService]
})
export class ClientRequestsModule {}
