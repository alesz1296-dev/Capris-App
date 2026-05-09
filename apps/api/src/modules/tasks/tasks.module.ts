import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CatalogsModule } from "../catalogs/catalogs.module";
import { EvidenceModule } from "../evidence/evidence.module";
import { IdentityAccessModule } from "../identity-access/identity-access.module";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";

@Module({
  imports: [AuthModule, CatalogsModule, EvidenceModule, IdentityAccessModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService]
})
export class TasksModule {}
