import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { IdentityAccessModule } from "../identity-access/identity-access.module";
import { ExceptionsController } from "./exceptions.controller";
import { ExceptionsService } from "./exceptions.service";

@Module({
  imports: [AuthModule, IdentityAccessModule],
  controllers: [ExceptionsController],
  providers: [ExceptionsService]
})
export class ExceptionsModule {}
