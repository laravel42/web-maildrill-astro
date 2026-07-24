import { describe, expect, it } from "vitest";
import { canTransition, isTerminal, resolveEventTransition } from "./state";

describe("state machine", () => {
  it("allows forward transitions", () => {
    expect(canTransition("queued", "processing")).toBe(true);
    expect(canTransition("processing", "submitted")).toBe(true);
    expect(canTransition("submitted", "delivered")).toBe(true);
    expect(canTransition("delivered", "read")).toBe(true);
  });

  it("rejects regressive / invalid transitions", () => {
    expect(canTransition("delivered", "sent")).toBe(false);
    expect(canTransition("read", "delivered")).toBe(false);
    expect(canTransition("sent", "queued")).toBe(false);
    expect(canTransition("failed", "submitted")).toBe(false);
  });

  it("allows expiry after a message is accepted (submitted/sent)", () => {
    expect(canTransition("submitted", "expired")).toBe(true);
    expect(canTransition("sent", "expired")).toBe(true);
  });

  it("marks terminal states", () => {
    expect(isTerminal("read")).toBe(true);
    expect(isTerminal("failed")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
    expect(isTerminal("queued")).toBe(false);
    expect(isTerminal("delivered")).toBe(false);
  });
});

describe("resolveEventTransition", () => {
  it("advances on delivery/engagement events", () => {
    expect(resolveEventTransition("submitted", "delivered")).toBe("delivered");
    expect(resolveEventTransition("sent", "read")).toBe("read");
    expect(resolveEventTransition("submitted", "sent")).toBe("sent");
  });

  it("ignores out-of-order regressive delivery events (delivered → sent)", () => {
    expect(resolveEventTransition("delivered", "sent")).toBeNull();
    expect(resolveEventTransition("read", "delivered")).toBeNull();
  });

  it("does not resurrect hard-terminal states", () => {
    expect(resolveEventTransition("read", "delivered")).toBeNull();
    expect(resolveEventTransition("cancelled", "delivered")).toBeNull();
    expect(resolveEventTransition("expired", "sent")).toBeNull();
  });

  it("does not regress a positive delivery signal into failed", () => {
    expect(resolveEventTransition("delivered", "failed")).toBeNull();
    expect(resolveEventTransition("sent", "failed")).toBeNull();
  });

  it("allows failure from processing/submitted", () => {
    expect(resolveEventTransition("submitted", "failed")).toBe("failed");
    expect(resolveEventTransition("processing", "failed")).toBe("failed");
  });

  it("expires accepted messages on a provider EXPIRED report", () => {
    expect(resolveEventTransition("submitted", "expired")).toBe("expired");
    expect(resolveEventTransition("sent", "expired")).toBe("expired");
  });

  it("does not expire a message that already reached delivered/read", () => {
    expect(resolveEventTransition("delivered", "expired")).toBeNull();
    expect(resolveEventTransition("read", "expired")).toBeNull();
  });
});
