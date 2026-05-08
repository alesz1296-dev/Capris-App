import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { IdentityAccessModule } from "../identity-access/identity-access.module";
import { AuthController } from "./auth.controller";
import { ActorAccessService } from "./actor-access.service";
import { AuthService } from "./auth.service";
import { AuthTokenService } from "./auth-token.service";
import { GoogleIdentityService } from "./google-identity.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PermissionGuard } from "./permission.guard";

@Module({
  imports: [DatabaseModule, IdentityAccessModule],
  controllers: [AuthController],
  providers: [ActorAccessService, AuthService, AuthTokenService, GoogleIdentityService, JwtAuthGuard, PermissionGuard],
  exports: [ActorAccessService, AuthService, AuthTokenService, JwtAuthGuard, PermissionGuard]
})
export class AuthModule {}
