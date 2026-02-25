import { z } from "zod";

export const CrossChannelAttributionSchema = z.object({
  customerJourneys: z.array(z.object({
    journeyId: z.string(),
    channels: z.array(z.object({
      channel: z.string(),
      touchpoint: z.string(),
      timestamp: z.string(),
      engagement: z.number(),
    })),
    conversions: z.number(),
    revenue: z.number(),
    conversionPath: z.array(z.string()),
  })),
  attributionModels: z.object({
    firstTouch: z.record(z.string(), z.number()).describe("First touch attribution"),
    lastTouch: z.record(z.string(), z.number()).describe("Last touch attribution"),
    linear: z.record(z.string(), z.number()).describe("Linear attribution"),
    timeDecay: z.record(z.string(), z.number()).describe("Time decay attribution"),
    positionBased: z.record(z.string(), z.number()).describe("Position based attribution"),
  }),
  channelPerformance: z.array(z.object({
    channel: z.string(),
    firstTouchAttribution: z.number(),
    lastTouchAttribution: z.number(),
    assistedConversions: z.number(),
    directConversions: z.number(),
    revenue: z.number(),
    roi: z.number(),
  })),
  insights: z.array(z.object({
    finding: z.string(),
    implication: z.string(),
    recommendation: z.string(),
  })),
  optimalChannelMix: z.object({
    recommended: z.record(z.string(), z.number()).describe("Recommended budget allocation"),
    rationale: z.string(),
  }),
  confidenceScore: z.number().min(0).max(1),
});

export type CrossChannelAttribution = z.infer<typeof CrossChannelAttributionSchema>;

export const CrossChannelAttributionInputSchema = z.object({
  organizationId: z.string(),
  brandName: z.string(),
  channels: z.array(z.string()),
  dateRange: z.object({ start: z.string(), end: z.string() }),
  customerData: z.array(z.object({
    customerId: z.string(),
    touchpoints: z.array(z.object({
      channel: z.string(),
      timestamp: z.string(),
      type: z.enum(["impression", "click", "engagement", "purchase"]),
      value: z.number().optional(),
    })),
    conversion: z.object({
      converted: z.boolean(),
      revenue: z.number().optional(),
      timestamp: z.string().optional(),
    }).optional(),
  })).optional(),
});

export type CrossChannelAttributionInput = z.infer<typeof CrossChannelAttributionInputSchema>;
