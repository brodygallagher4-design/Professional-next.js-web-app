import { describe, it, expect } from "vitest";
import { cartItemSchema, reviewSchema, adSchema } from "./schemas";

describe("cartItemSchema", () => {
  it("accepts a valid item and coerces a numeric-string price", () => {
    const r = cartItemSchema.safeParse({ title: "1 Year VPN", price: "2.98", brand: "vpn" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.price).toBe(2.98);
  });
  it("rejects an empty title", () => {
    const r = cartItemSchema.safeParse({ title: "  ", price: 5 });
    expect(r.success).toBe(false);
  });
  it("rejects a zero or negative price", () => {
    expect(cartItemSchema.safeParse({ title: "x", price: 0 }).success).toBe(false);
    expect(cartItemSchema.safeParse({ title: "x", price: -1 }).success).toBe(false);
  });
  it("rejects an absurd price", () => {
    expect(cartItemSchema.safeParse({ title: "x", price: 5_000_000 }).success).toBe(false);
  });
  it("trims and length-limits the description", () => {
    const long = "a".repeat(600);
    expect(cartItemSchema.safeParse({ title: "x", price: 1, description: long }).success).toBe(false);
  });
});

describe("reviewSchema", () => {
  it("requires an order_id", () => {
    expect(reviewSchema.safeParse({ sentiment: "positive" }).success).toBe(false);
  });
  it("defaults sentiment to positive", () => {
    const r = reviewSchema.safeParse({ order_id: "abc" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.sentiment).toBe("positive");
  });
  it("only allows positive|negative sentiment", () => {
    expect(reviewSchema.safeParse({ order_id: "abc", sentiment: "meh" }).success).toBe(false);
  });
});

describe("adSchema", () => {
  it("accepts a valid listing with defaults", () => {
    const r = adSchema.safeParse({ title: "USA WhatsApp", price: 3.5 });
    expect(r.success).toBe(true);
    if (r.success) { expect(r.data.quantity).toBe(1); expect(r.data.brand).toBe("whatsapp"); }
  });
  it("rejects quantity below 1", () => {
    expect(adSchema.safeParse({ title: "x", price: 1, quantity: 0 }).success).toBe(false);
  });
  it("rejects a missing title", () => {
    expect(adSchema.safeParse({ price: 1 }).success).toBe(false);
  });
});
