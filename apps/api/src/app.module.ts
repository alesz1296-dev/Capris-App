import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthModule } from "./modules/auth/auth.module";
import { CatalogsModule } from "./modules/catalogs/catalogs.module";
import { ConsignationsModule } from "./modules/consignations/consignations.module";
import { DatabaseModule } from "./modules/database/database.module";
import { EvidenceModule } from "./modules/evidence/evidence.module";
import { FieldOperationsModule } from "./modules/field-operations/field-operations.module";
import { IdentityAccessModule } from "./modules/identity-access/identity-access.module";
import { NotesModule } from "./modules/notes/notes.module";
import { ObjectStorageModule } from "./modules/object-storage/object-storage.module";
import { SystemHealthModule } from "./modules/system-health/system-health.module";
import { TasksModule } from "./modules/tasks/tasks.module";
import { VisitsModule } from "./modules/visits/visits.module";
import { JwtAuthGuard } from "./modules/auth/jwt-auth.guard";

@Module({
  imports: [
    AuthModule,
    CatalogsModule,
    ConsignationsModule,
    DatabaseModule,
    EvidenceModule,
    FieldOperationsModule,
    IdentityAccessModule,
    NotesModule,
    ObjectStorageModule,
    SystemHealthModule,
    TasksModule,
    VisitsModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    }
  ]
})
export class AppModule {}
