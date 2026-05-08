import { Global, Module } from "@nestjs/common";
import { DatabaseSeederService } from "./database-seeder.service";
import { PrismaService } from "./prisma.service";

@Global()
@Module({
  providers: [PrismaService, DatabaseSeederService],
  exports: [PrismaService, DatabaseSeederService]
})
export class DatabaseModule {}

