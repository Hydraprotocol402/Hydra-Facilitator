/**
 * Express Server Example
 *
 * This example demonstrates integrating the facilitator package into an Express.js server.
 */

import express from "express";
import { verify, settle } from "x402-hydra-facilitator";
import { createConnectedClient, createSigner } from "x402-hydra-facilitator/shared";
import {
  PaymentPayloadSchema,
  PaymentRequirementsSchema,
} from "x402-hydra-facilitator/types";

const app = express();
app.use(express.json());

// Environment configuration
const PORT = process.env.PORT || 3000;
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

if (!PRIVATE_KEY) {
  console.error("PRIVATE_KEY environment variable is required");
  process.exit(1);
}

/**
 * POST /verify
 * Verifies a payment payload against payment requirements
 */
app.post("/verify", async (req, res) => {
  try {
    // Validate request body
    const { paymentPayload, paymentRequirements } = req.body;

    const validatedPayload = PaymentPayloadSchema.parse(paymentPayload);
    const validatedRequirements = PaymentRequirementsSchema.parse(paymentRequirements);

    // Create client based on network
    const client = createConnectedClient(validatedRequirements.network);

    // Verify payment
    const result = await verify(client, validatedPayload, validatedRequirements);

    res.json(result);
  } catch (error) {
    console.error("Verification error:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /settle
 * Settles a verified payment on the blockchain
 */
app.post("/settle", async (req, res) => {
  try {
    // Validate request body
    const { paymentPayload, paymentRequirements } = req.body;

    const validatedPayload = PaymentPayloadSchema.parse(paymentPayload);
    const validatedRequirements = PaymentRequirementsSchema.parse(paymentRequirements);

    // Create signer
    const signer = await createSigner(validatedRequirements.network, PRIVATE_KEY);

    // Settle payment
    const result = await settle(signer, validatedPayload, validatedRequirements);

    res.json(result);
  } catch (error) {
    console.error("Settlement error:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Facilitator server running on port ${PORT}`);
});

