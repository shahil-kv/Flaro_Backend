import rateLimit from "express-rate-limit";
import { Request, Response } from "express";
import "express";

// src/types/express.d.ts (or any other global types file)
declare module "express" {
  interface Request {
    clientIp?: string;
  }
}

// Create the limiter with proper types
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
  // Remove keyGenerator to use default IP handling
  handler: (req: Request, res: Response) => {
    return res.status(429).json({
      status: "error",
      message: `Too many requests. You are only allowed 5000 requests per 15 minutes.`,
    });
  },
});

export default limiter;