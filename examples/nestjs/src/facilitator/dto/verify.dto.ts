import { IsObject } from "class-validator";
import { PaymentPayload, PaymentRequirements } from "x402/types";

export class VerifyRequestDto {
  @IsObject()
  paymentPayload!: PaymentPayload;

  @IsObject()
  paymentRequirements!: PaymentRequirements;
}
