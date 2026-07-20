import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

describe("ReturnListRow", () => {
  const source = readFileSync(resolve(process.cwd(), "src/components/returns/ReturnListRow.vue"), "utf8");

  it("uses the shared list-item contract and keyboard-accessible link behavior", () => {
    expect(source).toContain("class=\"list-item return-result-row\"");
    expect(source).toContain("role=\"link\"");
    expect(source).toContain("tabindex=\"0\"");
    expect(source).toContain("@keydown.enter.prevent");
    expect(source).toContain("@keydown.space.prevent");
  });

  it("renders return identity, context, amount, type, and status", () => {
    expect(source).toContain("{{ rmaLabel }}");
    expect(source).toContain("{{ primaryLabel }}");
    expect(source).toContain("{{ secondaryLabel }}");
    expect(source).toContain("translate('Return date')");
    expect(source).toContain("class=\"tablet return-channel\"");
    expect(source).toContain("translate('Channel')");
    expect(source).toContain("translate('Return total')");
    expect(source).toContain(":color=\"statusColor\"");
    expect(source).toContain("v-if=\"typeLabel\"");
  });

  it("allocates a dedicated responsive column to the return channel", () => {
    expect(source).toContain("--columns-desktop: 5");
    expect(source).toContain("--columns-tablet: 5");
    expect(source).not.toContain('<p v-if="channelLabel">');
  });
});
