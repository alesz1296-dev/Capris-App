import { Module } from "@nestjs/common";
import { CatalogsModule } from "../catalogs/catalogs.module";
import { IdentityAccessModule } from "../identity-access/identity-access.module";
import { ObjectStorageModule } from "../object-storage/object-storage.module";
import { EvidenceController } from "./evidence.controller";
import { EvidenceService } from "./evidence.service";

@Module({
  imports: [CatalogsModule, IdentityAccessModule, ObjectStorageModule],
  controllers: [EvidenceController],
  providers: [EvidenceService],
  exports: [EvidenceService]
})
export class EvidenceModule {}
