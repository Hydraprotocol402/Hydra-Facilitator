import { IsNumber, IsObject, IsOptional } from "class-validator";
import {
  PaymentPayload,
  PaymentRequirements,
} from "x402-hydra-facilitator/types";

export class SettleRequestDto {
  @IsOptional()
  @IsNumber()
  x402Version?: number;

  @IsObject()
  paymentPayload!: PaymentPayload;

  @IsObject()
  paymentRequirements!: PaymentRequirements;
}
