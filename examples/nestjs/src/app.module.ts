import { Module } from "@nestjs/common";
import { ConfigModule } from "./config/config.module";
import { FacilitatorModule } from "./facilitator/facilitator.module";

@Module({
  imports: [ConfigModule, FacilitatorModule],
})
export class AppModule {}
