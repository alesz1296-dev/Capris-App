import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ExhibitionsController } from "./exhibitions.controller";
import { ExhibitionsService } from "./exhibitions.service";

@Module({
  imports: [AuthModule],
  controllers: [ExhibitionsController],
  providers: [ExhibitionsService],
  exports: [ExhibitionsService]
})
export class ExhibitionsModule {}
