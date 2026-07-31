import { describe, expect, it } from "vitest";
import { outcomeFromInfobipStatusGroup } from "@maildrill/domain";
import { mapLatestStatusGroups, shouldCompleteCampaign } from "./campaign-delivery";

describe("outcomeFromInfobipStatusGroup", () => {
  it("maps Infobip groups to provider outcomes", () => {
    expect(outcomeFromInfobipStatusGroup("DELIVERED")).toBe("delivered");
    expect(outcomeFromInfobipStatusGroup("PENDING")).toBe("submitted");
    expect(outcomeFromInfobipStatusGroup("UNDELIVERABLE")).toBe("failed");
    expect(outcomeFromInfobipStatusGroup("REJECTED")).toBe("failed");
    expect(outcomeFromInfobipStatusGroup("EXPIRED")).toBe("expired");
    expect(outcomeFromInfobipStatusGroup("UNKNOWN")).toBe("sent");
  });
});

describe("mapLatestStatusGroups", () => {
  it("maps fixture HogQL rows", () => {
    const rows = mapLatestStatusGroups(
      ["maildrill_message_id", "status_group", "error_name", "error_description"],
      [
        ["msg-1", "DELIVERED", "", ""],
        ["msg-2", "UNDELIVERABLE", "EC_FREQUENCY_CAPPING", "Frequency capping limit reached"],
        ["msg-1", "PENDING", "", ""], // duplicate id ignored
      ],
    );
    expect(rows).toEqual([
      { maildrillMessageId: "msg-1", statusGroup: "DELIVERED" },
      {
        maildrillMessageId: "msg-2",
        statusGroup: "UNDELIVERABLE",
        errorName: "EC_FREQUENCY_CAPPING",
        errorDescription: "Frequency capping limit reached",
      },
    ]);
  });

  it("returns empty when columns missing", () => {
    expect(mapLatestStatusGroups(["day"], [["x"]])).toEqual([]);
  });
});

describe("shouldCompleteCampaign", () => {
  it("completes when every message has left the send queue", () => {
    expect(shouldCompleteCampaign([])).toBe(true);
    expect(shouldCompleteCampaign(["delivered", "failed", "expired"])).toBe(true);
    expect(shouldCompleteCampaign(["delivered", "read"])).toBe(true);
    expect(shouldCompleteCampaign(["delivered", "submitted"])).toBe(true);
    expect(shouldCompleteCampaign(["sent", "submitted"])).toBe(true);
  });

  it("stays open while any message is still queued / processing", () => {
    expect(shouldCompleteCampaign(["queued"])).toBe(false);
    expect(shouldCompleteCampaign(["processing"])).toBe(false);
    expect(shouldCompleteCampaign(["submitted", "queued"])).toBe(false);
    expect(shouldCompleteCampaign(["draft", "submitted"])).toBe(false);
  });
});
