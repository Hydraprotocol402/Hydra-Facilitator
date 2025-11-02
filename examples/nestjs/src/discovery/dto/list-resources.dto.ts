import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsObject,
} from "class-validator";
import { Type } from "class-transformer";

export class ListResourcesDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
