import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CatalogsModule } from "../catalogs/catalogs.module";
import { IdentityAccessModule } from "../identity-access/identity-access.module";
import { TasksModule } from "../tasks/tasks.module";
import { VisitsController } from "./visits.controller";
import { VisitsService } from "./visits.service";

@Module({
  imports: [AuthModule, CatalogsModule, IdentityAccessModule, TasksModule],
  controllers: [VisitsController],
  providers: [VisitsService],
  exports: [VisitsService]
})
export class VisitsModule {}
