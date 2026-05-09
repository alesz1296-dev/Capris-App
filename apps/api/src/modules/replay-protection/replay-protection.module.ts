import { Global, Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { ReplayProtectionService } from "./replay-protection.service";

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [ReplayProtectionService],
  exports: [ReplayProtectionService]
})
export class ReplayProtectionModule {}
