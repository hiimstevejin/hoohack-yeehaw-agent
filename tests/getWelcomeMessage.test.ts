import { describe, expect, it } from "vitest";
import { getWelcomeMessage } from "../src/lib/getWelcomeMessage";

describe("getWelcomeMessage", () => {
  it("returns the boilerplate copy", () => {
    expect(getWelcomeMessage()).toContain("Next.js 15");
  });
});
