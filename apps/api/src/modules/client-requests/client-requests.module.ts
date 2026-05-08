import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ClientRequestsController } from "./client-requests.controller";
import { ClientRequestsService } from "./client-requests.service";

@Module({
  imports: [AuthModule],
  controllers: [ClientRequestsController],
  providers: [ClientRequestsService],
  exports: [ClientRequestsService]
})
export class ClientRequestsModule {}
