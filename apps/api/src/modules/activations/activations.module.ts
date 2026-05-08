import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ActivitiesController } from "./activations.controller";
import { ActivitiesService } from "./activations.service";

@Module({
  imports: [AuthModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
  exports: [ActivitiesService]
})
export class ActivitiesModule {}
