import { IsObject } from "class-validator";
import {
  PaymentPayload,
  PaymentRequirements,
} from "x402-hydra-facilitator/types";

export class SettleRequestDto {
  @IsObject()
  paymentPayload!: PaymentPayload;

  @IsObject()
  paymentRequirements!: PaymentRequirements;
}
