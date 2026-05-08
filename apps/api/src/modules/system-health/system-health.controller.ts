import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/public.decorator";

@Controller("system-health")
export class SystemHealthController {
  @Get()
  @Public()
  getHealth() {
    return {
      status: "ok",
      checks: {
        api: "ok",
        syncQueue: "pending_integration",
        email: "pending_integration",
        media: "pending_integration"
      }
    };
  }
}
