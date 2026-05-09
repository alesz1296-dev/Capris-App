import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ObjectStorageModule } from "../object-storage/object-storage.module";
import { ConsignationsController } from "./consignations.controller";
import { ConsignationsService } from "./consignations.service";

@Module({
  imports: [AuthModule, ObjectStorageModule],
  controllers: [ConsignationsController],
  providers: [ConsignationsService],
  exports: [ConsignationsService]
})
export class ConsignationsModule {}
