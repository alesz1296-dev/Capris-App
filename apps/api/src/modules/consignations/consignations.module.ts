import { Module } from "@nestjs/common";
import { ConsignationsController } from "./consignations.controller";
import { ConsignationsService } from "./consignations.service";

@Module({
  controllers: [ConsignationsController],
  providers: [ConsignationsService],
  exports: [ConsignationsService]
})
export class ConsignationsModule {}
