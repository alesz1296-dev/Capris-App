import { Controller, Get } from "@nestjs/common";

@Controller("system-health")
export class SystemHealthController {
  @Get()
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

