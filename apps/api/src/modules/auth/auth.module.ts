import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthTokenService } from "./auth-token.service";
import { GoogleIdentityService } from "./google-identity.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [AuthService, AuthTokenService, GoogleIdentityService, JwtAuthGuard],
  exports: [AuthService, AuthTokenService, JwtAuthGuard]
})
export class AuthModule {}
