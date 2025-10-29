import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from "@nestjs/common";
import { FacilitatorService } from "./facilitator.service";
import { VerifyRequestDto } from "./dto/verify.dto";
import { SettleRequestDto } from "./dto/settle.dto";
import { PaymentPayloadSchema, PaymentRequirementsSchema } from "x402/types";

@Controller()
export class FacilitatorController {
  constructor(private readonly facilitatorService: FacilitatorService) {}

  @Get("verify")
  getVerifyInfo() {
    console.log("getVerifyInfo");
    return {
      endpoint: "/verify",
      description: "POST to verify x402 payments",
      body: {
        paymentPayload: "PaymentPayload",
        paymentRequirements: "PaymentRequirements",
      },
    };
  }

  @Post("verify")
  @HttpCode(HttpStatus.OK)
  async verify(@Body() body: VerifyRequestDto) {
    console.log("verify", body);
    try {
      // Validate schemas
      const paymentRequirements = PaymentRequirementsSchema.parse(
        body.paymentRequirements,
      );
      const paymentPayload = PaymentPayloadSchema.parse(body.paymentPayload);

      return await this.facilitatorService.verifyPayment(
        paymentPayload,
        paymentRequirements,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Invalid request: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  @Get("settle")
  getSettleInfo() {
    console.log("getSettleInfo");
    return {
      endpoint: "/settle",
      description: "POST to settle x402 payments",
      body: {
        paymentPayload: "PaymentPayload",
        paymentRequirements: "PaymentRequirements",
      },
    };
  }

  @Post("settle")
  @HttpCode(HttpStatus.OK)
  async settle(@Body() body: SettleRequestDto) {
    console.log("settle", body);
    try {
      // Validate schemas
      const paymentRequirements = PaymentRequirementsSchema.parse(
        body.paymentRequirements,
      );
      const paymentPayload = PaymentPayloadSchema.parse(body.paymentPayload);

      return await this.facilitatorService.settlePayment(
        paymentPayload,
        paymentRequirements,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Invalid request: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  @Get("supported")
  async getSupported() {
    console.log("getSupported");
    return await this.facilitatorService.getSupportedPaymentKinds();
  }
}
