import {
  Controller,
  Get,
  Query,
  HttpCode,
  HttpStatus,
  Redirect,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { DiscoveryService } from "./discovery.service";
import { ListResourcesDto } from "./dto/list-resources.dto";
import { PinoLogger } from "nestjs-pino";

@Controller()
export class DiscoveryController {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(DiscoveryController.name);
  }

  @Get("discovery/resources")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 200, ttl: 60000 } })
  async listResources(
    @Query() query: ListResourcesDto,
  ): Promise<Awaited<ReturnType<DiscoveryService["findResources"]>>> {
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;

    const filters = {
      type: query.type,
      metadata: query.metadata,
    };

    this.logger.info(
      {
        filters,
        limit,
        offset,
      },
      "Listing discovery resources",
    );

    return await this.discoveryService.findResources(filters, limit, offset);
  }

  @Get("list")
  @HttpCode(HttpStatus.MOVED_PERMANENTLY)
  @Throttle({ default: { limit: 200, ttl: 60000 } })
  @Redirect("/discovery/resources", HttpStatus.MOVED_PERMANENTLY)
  async list(): Promise<void> {
    this.logger.debug("Redirecting /list to /discovery/resources");
    // Redirect handled by @Redirect decorator
  }
}
