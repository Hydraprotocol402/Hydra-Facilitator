import { Controller, Get } from "@nestjs/common";
import {
  HealthCheckService,
  HealthCheck,
  MemoryHealthIndicator,
} from "@nestjs/terminus";

@Controller("health")
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.memory.checkHeap("memory_heap", 500 * 1024 * 1024), // 500MB
      () => this.memory.checkRSS("memory_rss", 1000 * 1024 * 1024), // 1GB
    ]);
  }

  @Get("ready")
  ready() {
    return { status: "ready", timestamp: new Date().toISOString() };
  }

  @Get("live")
  live() {
    return { status: "live", timestamp: new Date().toISOString() };
  }
}
