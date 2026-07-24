import { describe, expect, it } from "vitest";
import { dispatchJobId, eventFingerprint, webhookFingerprint } from "./idempotency";

describe("idempotency helpers", () => {
  it("dispatchJobId is deterministic and generation-scoped", () => {
    expect(dispatchJobId("t", "m", 0)).toBe("send_t_m_0");
    expect(dispatchJobId("t", "m", 0)).toBe(dispatchJobId("t", "m", 0));
    expect(dispatchJobId("t", "m", 1)).not.toBe(dispatchJobId("t", "m", 0));
  });

  // BullMQ rejects custom job ids containing ":" ("Custom Id cannot contain :"),
  // which silently failed every outbox publish and blocked all sends.
  it("dispatchJobId never contains a colon", () => {
    const id = dispatchJobId(
      "6f1b6a1e-0000-4000-8000-000000000001",
      "9a2c5d3f-0000-4000-8000-000000000002",
      3,
    );
    expect(id).not.toContain(":");
  });

  it("event fingerprints are stable and content-sensitive", () => {
    expect(eventFingerprint("mock", ["a", "b"])).toBe(eventFingerprint("mock", ["a", "b"]));
    expect(eventFingerprint("mock", ["a", "b"])).not.toBe(
      eventFingerprint("mock", ["a", "c"]),
    );
    expect(eventFingerprint("mock", ["a"])).not.toBe(eventFingerprint("infobip", ["a"]));
  });

  it("webhook fingerprints dedupe identical bodies", () => {
    expect(webhookFingerprint("p", "body")).toBe(webhookFingerprint("p", "body"));
    expect(webhookFingerprint("p", "body")).not.toBe(webhookFingerprint("p", "other"));
  });
});
