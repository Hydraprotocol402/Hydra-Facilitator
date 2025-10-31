import { Module, OnModuleInit } from "@nestjs/common";
import { TracingService } from "./tracing.service";

@Module({
  providers: [TracingService],
  exports: [TracingService],
})
export class TracingModule implements OnModuleInit {
  constructor(private readonly tracingService: TracingService) {}

  async onModuleInit() {
    await this.tracingService.initialize();
  }
}
