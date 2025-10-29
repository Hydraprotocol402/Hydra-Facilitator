import { IsObject } from "class-validator";
import { PaymentPayload, PaymentRequirements } from "x402/types";

export class SettleRequestDto {
  @IsObject()
  paymentPayload!: PaymentPayload;

  @IsObject()
  paymentRequirements!: PaymentRequirements;
}
