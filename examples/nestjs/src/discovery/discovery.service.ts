import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { PaymentRequirements } from "x402-hydra-facilitator/types";
import { PinoLogger } from "nestjs-pino";
import { ConfigService } from "../config/config.service";
import { URL } from "url";

export interface DiscoveryResource {
  resource: string;
  type: string;
  x402Version: number;
  accepts: PaymentRequirements[];
  lastUpdated: string; // ISO timestamp
  metadata?: Record<string, any>;
}

export interface ListDiscoveryResponse {
  x402Version: number;
  items: DiscoveryResource[];
  pagination?: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface ListResourcesFilters {
  type?: string;
  metadata?: Record<string, any>;
}

const TTL_DAYS = 7; // Resources inactive for 7+ days are filtered
const DEBOUNCE_HOURS = 24; // Update if last updated > 24 hours ago

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
    private readonly configService: ConfigService,
  ) {
    this.logger.setContext(DiscoveryService.name);
  }

  /**
   * Validates that a resource URL is a valid URL
   * For production: Requires HTTPS and rejects localhost/private IPs
   * For development (ALLOW_LOCALHOST_RESOURCES=true): Allows HTTP/HTTPS for localhost/private IPs only
   */
  private validateResourceUrl(url: string): boolean {
    if (!url || typeof url !== "string") {
      return false;
    }
    try {
      const parsed = new URL(url);

      // Must be HTTP or HTTPS
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return false;
      }

      const hostname = parsed.hostname.toLowerCase();

      // Check if this is a localhost or private IP
      const isLocalhost =
        hostname === "localhost" ||
        hostname.startsWith("localhost.") ||
        hostname === "127.0.0.1" ||
        hostname === "::1" ||
        hostname === "0.0.0.0";

      const privateIpRegex =
        /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.)/;
      const isPrivateIp = privateIpRegex.test(hostname);

      const isLocal = isLocalhost || isPrivateIp;

      // If localhost is allowed, accept HTTP/HTTPS for local resources
      if (this.configService.allowLocalhostResources && isLocal) {
        return true;
      }

      // For production/public resources: require HTTPS
      if (parsed.protocol !== "https:") {
        return false;
      }

      // Reject localhost and private IPs in production
      if (isLocal) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks if payment requirements have changed significantly
   */
  private hasSignificantChanges(
    existing: PaymentRequirements,
    incoming: PaymentRequirements,
  ): boolean {
    // Check if critical fields changed
    return (
      existing.payTo.toLowerCase() !== incoming.payTo.toLowerCase() ||
      existing.asset.toLowerCase() !== incoming.asset.toLowerCase() ||
      existing.maxAmountRequired !== incoming.maxAmountRequired ||
      existing.network !== incoming.network ||
      existing.scheme !== incoming.scheme
    );
  }

  /**
   * Checks if resource needs update based on debouncing rules
   */
  private shouldUpdate(
    existing: {
      resource: string;
      payTo: string;
      lastUpdated: Date;
      accepts: PaymentRequirements[];
    },
    incoming: PaymentRequirements,
  ): boolean {
    // Always update if resource URL changed (shouldn't happen, but safety check)
    if (existing.resource !== incoming.resource) {
      return true;
    }

    // Check if any existing payment requirement has significant changes
    const matchingReq = existing.accepts.find(
      (req) =>
        req.payTo.toLowerCase() === incoming.payTo.toLowerCase() &&
        req.asset.toLowerCase() === incoming.asset.toLowerCase() &&
        req.network === incoming.network,
    );

    if (matchingReq) {
      // Check if requirements changed significantly
      if (this.hasSignificantChanges(matchingReq, incoming)) {
        return true;
      }
      // Check if payTo address changed for this specific requirement
      if (existing.payTo !== incoming.payTo) {
        return true;
      }
    }

    // Update if last updated > 24 hours ago
    const hoursSinceUpdate =
      (Date.now() - existing.lastUpdated.getTime()) / (1000 * 60 * 60);
    if (hoursSinceUpdate > DEBOUNCE_HOURS) {
      return true;
    }

    return false;
  }

  /**
   * Registers or updates a discovery resource based on payment requirements
   * Only updates if resource changed OR if last updated > 24 hours ago
   */
  async registerResource(
    paymentRequirements: PaymentRequirements,
    network: string,
  ): Promise<void> {
    // Skip if no resource URL provided
    if (!paymentRequirements.resource) {
      this.logger.debug("No resource URL provided, skipping registration");
      return;
    }

    // Validate resource URL
    if (!this.validateResourceUrl(paymentRequirements.resource)) {
      this.logger.warn(
        { resource: paymentRequirements.resource },
        "Invalid resource URL, skipping registration",
      );
      return;
    }

    try {
      const now = new Date();
      const resourceUrl = paymentRequirements.resource;

      // Find existing resource
      const existing = await this.prisma.discoveryResource.findUnique({
        where: { resource: resourceUrl },
      });

      if (existing) {
        // Check if update is needed
        const existingAccepts = existing.accepts as PaymentRequirements[];
        const shouldUpdate = this.shouldUpdate(
          {
            resource: existing.resource,
            payTo: paymentRequirements.payTo,
            lastUpdated: existing.lastUpdated,
            accepts: existingAccepts,
          },
          paymentRequirements,
        );

        if (!shouldUpdate) {
          this.logger.debug(
            { resource: resourceUrl },
            "Resource recently updated, skipping",
          );
          return;
        }

        // Check if this exact payment requirement already exists
        const reqIndex = existingAccepts.findIndex(
          (req) =>
            req.payTo.toLowerCase() ===
              paymentRequirements.payTo.toLowerCase() &&
            req.asset.toLowerCase() ===
              paymentRequirements.asset.toLowerCase() &&
            req.network === network,
        );

        let updatedAccepts: PaymentRequirements[];
        if (reqIndex >= 0) {
          // Update existing requirement
          updatedAccepts = [...existingAccepts];
          updatedAccepts[reqIndex] = paymentRequirements;
        } else {
          // Add new payment requirement
          updatedAccepts = [...existingAccepts, paymentRequirements];
        }

        // Update resource (clear deletedAt to reactivate if needed)
        await this.prisma.discoveryResource.update({
          where: { id: existing.id },
          data: {
            accepts: updatedAccepts as any,
            lastUpdated: now,
            deletedAt: null, // Reactivate if it was soft-deleted
            updatedAt: now,
          },
        });

        this.logger.info(
          {
            resource: resourceUrl,
            network,
            payTo: paymentRequirements.payTo,
          },
          "Updated discovery resource",
        );
      } else {
        // Create new resource
        await this.prisma.discoveryResource.create({
          data: {
            resource: resourceUrl,
            type: "http",
            x402Version: 1,
            accepts: [paymentRequirements] as any,
            lastUpdated: now,
            metadata: {},
          },
        });

        this.logger.info(
          {
            resource: resourceUrl,
            network,
            payTo: paymentRequirements.payTo,
          },
          "Registered new discovery resource",
        );
      }
    } catch (error) {
      // Non-critical error, log but don't throw
      this.logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          resource: paymentRequirements.resource,
        },
        "Failed to register discovery resource",
      );
    }
  }

  /**
   * Finds discovery resources with filters and pagination
   * Automatically excludes resources inactive for 7+ days (TTL)
   */
  async findResources(
    filters: ListResourcesFilters = {},
    limit: number = 100,
    offset: number = 0,
  ): Promise<ListDiscoveryResponse> {
    const maxLimit = 1000;
    const clampedLimit = Math.min(Math.max(1, limit), maxLimit);
    const clampedOffset = Math.max(0, offset);

    // Calculate TTL threshold (7 days ago)
    const ttlThreshold = new Date();
    ttlThreshold.setDate(ttlThreshold.getDate() - TTL_DAYS);

    // Build where clause
    const where: any = {
      // Only show resources updated in the last 7 days
      lastUpdated: {
        gte: ttlThreshold,
      },
      // Only show non-deleted resources
      deletedAt: null,
    };

    // Protocol and localhost filtering
    if (this.configService.allowLocalhostResources) {
      // Development mode: Allow HTTP/HTTPS for localhost/private IPs, HTTPS only for public
      where.OR = [
        { resource: { startsWith: "https://" } },
        // Only allow HTTP for localhost/private IPs
        {
          AND: [
            { resource: { startsWith: "http://" } },
            {
              OR: [
                { resource: { contains: "localhost", mode: "insensitive" } },
                { resource: { contains: "127.0.0.1" } },
                { resource: { contains: "0.0.0.0" } },
                { resource: { startsWith: "http://10." } },
                { resource: { startsWith: "http://192.168." } },
                { resource: { startsWith: "http://169.254." } },
                ...Array.from({ length: 16 }, (_, i) => ({
                  resource: { startsWith: `http://172.${i + 16}.` },
                })),
              ],
            },
          ],
        },
      ];
    } else {
      // Production mode: HTTPS only AND exclude localhost/private IPs
      // Build 172.16.0.0/12 range filters (172.16.x.x through 172.31.x.x)
      const private172Range: any[] = [];
      for (let i = 16; i <= 31; i++) {
        private172Range.push({ resource: { startsWith: `https://172.${i}.` } });
      }

      // Production mode: HTTPS only AND exclude localhost/private IPs
      // All conditions must be met: (lastUpdated >= threshold) AND (deletedAt IS NULL)
      // AND (resource starts with https://) AND (resource does NOT contain localhost/private IPs)
      where.AND = [
        { lastUpdated: { gte: ttlThreshold } },
        { deletedAt: null },
        { resource: { startsWith: "https://" } },
        {
          NOT: {
            OR: [
              {
                resource: {
                  contains: "localhost",
                  mode: "insensitive",
                },
              },
              { resource: { contains: "127.0.0.1" } },
              { resource: { contains: "0.0.0.0" } },
              { resource: { startsWith: "https://10." } },
              { resource: { startsWith: "https://192.168." } },
              { resource: { startsWith: "https://169.254." } },
              ...private172Range,
            ],
          },
        },
      ];
      // Remove top-level properties since they're now in AND array
      delete where.lastUpdated;
      delete where.deletedAt;
    }

    // Apply type filter
    if (filters.type) {
      where.type = filters.type;
    }

    // Apply metadata filters (basic equality matching)
    if (filters.metadata && Object.keys(filters.metadata).length > 0) {
      // For JSONB metadata filtering, we'll use Prisma's JSON filters
      // This is a simple implementation - more complex queries can be added later
      for (const [key, value] of Object.entries(filters.metadata)) {
        where.metadata = {
          path: [key],
          equals: value,
        };
      }
    }

    try {
      // Get total count
      const total = await this.prisma.discoveryResource.count({ where });

      // Fetch resources
      const resources = await this.prisma.discoveryResource.findMany({
        where,
        orderBy: {
          lastUpdated: "desc",
        },
        take: clampedLimit,
        skip: clampedOffset,
      });

      // Transform to API format
      const items: DiscoveryResource[] = resources.map((r) => ({
        resource: r.resource,
        type: r.type,
        x402Version: r.x402Version,
        accepts: r.accepts as PaymentRequirements[],
        lastUpdated: r.lastUpdated.toISOString(),
        metadata: (r.metadata as Record<string, any>) || {},
      }));

      return {
        x402Version: 1,
        items,
        pagination: {
          limit: clampedLimit,
          offset: clampedOffset,
          total,
        },
      };
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          filters,
        },
        "Failed to find discovery resources",
      );

      // Return empty result on error
      return {
        x402Version: 1,
        items: [],
        pagination: {
          limit: clampedLimit,
          offset: clampedOffset,
          total: 0,
        },
      };
    }
  }

  /**
   * Optional: Cleanup resources that have been soft-deleted for > 30 days
   * Can be called via a scheduled task
   */
  async cleanupInactiveResources(): Promise<number> {
    const hardDeleteThreshold = new Date();
    hardDeleteThreshold.setDate(hardDeleteThreshold.getDate() - 30);

    try {
      const result = await this.prisma.discoveryResource.deleteMany({
        where: {
          deletedAt: {
            not: null,
            lt: hardDeleteThreshold,
          },
        },
      });

      this.logger.info(
        { deletedCount: result.count },
        "Cleaned up inactive discovery resources",
      );

      return result.count;
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to cleanup inactive resources",
      );
      return 0;
    }
  }
}
