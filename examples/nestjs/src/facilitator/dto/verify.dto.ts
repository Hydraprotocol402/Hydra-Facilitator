import { IsObject } from "class-validator";
import {
  PaymentPayload,
  PaymentRequirements,
} from "x402-hydra-facilitator/types";

export class VerifyRequestDto {
  @IsObject()
  paymentPayload!: PaymentPayload;

  @IsObject()
  paymentRequirements!: PaymentRequirements;
}
