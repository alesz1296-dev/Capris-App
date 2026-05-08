import { Module } from "@nestjs/common";
import { CatalogsModule } from "../catalogs/catalogs.module";
import { IdentityAccessModule } from "../identity-access/identity-access.module";
import { TasksModule } from "../tasks/tasks.module";
import { FieldOperationsController } from "./field-operations.controller";
import { FieldOperationsService } from "./field-operations.service";

@Module({
  imports: [CatalogsModule, IdentityAccessModule, TasksModule],
  controllers: [FieldOperationsController],
  providers: [FieldOperationsService],
  exports: [FieldOperationsService]
})
export class FieldOperationsModule {}
