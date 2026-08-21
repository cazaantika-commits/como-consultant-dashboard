import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");

describe("production build safeguards", () => {
  it("splits heavy vendor groups and avoids the compression-size pass", () => {
    const viteConfig = fs.readFileSync(path.join(projectRoot, "vite.config.ts"), "utf8");

    expect(viteConfig).toContain("reportCompressedSize: false");
    expect(viteConfig).toContain('"vendor-charts"');
    expect(viteConfig).toContain('"vendor-spreadsheet"');
    expect(viteConfig).toContain('"vendor-icons"');
  });

  it("loads the PDF parser only during proposal analysis", () => {
    const proposalsPage = fs.readFileSync(path.join(projectRoot, "client", "src", "pages", "ProposalsPage.tsx"), "utf8");

    expect(proposalsPage).not.toMatch(/from\s+["']pdfjs-dist["']/);
    expect(proposalsPage).toContain("PDFJS_MODULE_URL");
    expect(proposalsPage).toContain("loadPdfJs()");
  });
});
