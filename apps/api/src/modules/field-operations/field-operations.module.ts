import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CatalogsModule } from "../catalogs/catalogs.module";
import { DatabaseModule } from "../database/database.module";
import { IdentityAccessModule } from "../identity-access/identity-access.module";
import { TasksModule } from "../tasks/tasks.module";
import { FieldOperationsController } from "./field-operations.controller";
import { FieldOperationsService } from "./field-operations.service";

@Module({
  imports: [AuthModule, CatalogsModule, DatabaseModule, IdentityAccessModule, TasksModule],
  controllers: [FieldOperationsController],
  providers: [FieldOperationsService],
  exports: [FieldOperationsService]
})
export class FieldOperationsModule {}
