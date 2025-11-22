import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    // Only initialize PrismaClient if DATABASE_URL is configured
    // If not configured, PrismaClient will use a dummy connection string
    // that won't actually connect, but allows the service to be instantiated
    const databaseUrl = process.env.DATABASE_URL;
    const isDatabaseEnabled = !!databaseUrl;
    
    super(
      isDatabaseEnabled
        ? undefined
        : {
            datasources: {
              db: {
                url: "postgresql://dummy:dummy@localhost:5432/dummy",
              },
            },
            log: [],
          },
    );
  }

  private get isDatabaseEnabled(): boolean {
    return !!process.env.DATABASE_URL;
  }

  async onModuleInit() {
    if (this.isDatabaseEnabled) {
      try {
        await this.$connect();
      } catch (error) {
        // Silently fail if database is not available
        // This allows the app to run without a database
      }
    }
  }

  async onModuleDestroy() {
    if (this.isDatabaseEnabled) {
      try {
        await this.$disconnect();
      } catch (error) {
        // Ignore disconnect errors
      }
    }
  }
}
