import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ExceptionsController } from "./exceptions.controller";
import { ExceptionsService } from "./exceptions.service";

@Module({
  imports: [AuthModule],
  controllers: [ExceptionsController],
  providers: [ExceptionsService]
})
export class ExceptionsModule {}
