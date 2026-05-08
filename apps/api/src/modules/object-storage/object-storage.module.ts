import { Module } from "@nestjs/common";
import { ObjectStorageController } from "./object-storage.controller";
import { ObjectStorageService } from "./object-storage.service";

@Module({
  controllers: [ObjectStorageController],
  providers: [ObjectStorageService],
  exports: [ObjectStorageService]
})
export class ObjectStorageModule {}
