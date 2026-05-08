import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { Public } from "../auth/public.decorator";
import { ObjectStorageService } from "./object-storage.service";

@Controller("storage")
export class ObjectStorageController {
  constructor(private readonly objectStorageService: ObjectStorageService) {}

  @Get(":scope/:encodedKey")
  @Public()
  async getObject(
    @Param("scope") scope: string,
    @Param("encodedKey") encodedKey: string,
    @Query("expires") expires: string | undefined,
    @Query("signature") signature: string | undefined,
    @Res() response: Response
  ) {
    const result = await this.objectStorageService.getObject(scope, encodedKey, expires, signature);
    response.setHeader("Content-Type", result.contentType);
    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    response.send(result.bytes);
  }
}
