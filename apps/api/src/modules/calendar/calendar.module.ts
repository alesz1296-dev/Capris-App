import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { IdentityAccessModule } from "../identity-access/identity-access.module";
import { CalendarController } from "./calendar.controller";
import { CalendarService } from "./calendar.service";

@Module({
  imports: [AuthModule, IdentityAccessModule],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService]
})
export class CalendarModule {}
