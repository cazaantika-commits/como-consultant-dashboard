import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const home = readFileSync("client/src/pages/Home.tsx", "utf8");
const gallery = readFileSync("client/src/components/PreservedCapabilityGallery.tsx", "utf8");
const specialists = readFileSync("client/src/components/ComoNextSpecialistDesks.tsx", "utf8");
const kitchen = readFileSync("client/src/pages/ComoNextTodayPage.tsx", "utf8");
const sara = readFileSync("client/src/pages/SaraPage.tsx", "utf8");

describe("COMO visual identity", () => {
  it("restores rich gateway cards without turning Home into an operational dashboard", () => {
    expect(home).toContain("radial-gradient");
    expect(home).toContain("GatewayCard");
    expect(home).toContain("PreservedCapabilityGallery");
    expect(home).not.toContain("trpc.comoNext.getOverview.useQuery");
  });

  it("preserves all historical portraits while enabling only the two approved capabilities", () => {
    for (const name of ["براق", "فاروق", "خازن", "خالد", "ألينا", "باز", "جويل"]) expect(gallery).toContain(name);
    expect((gallery.match(/enabled: true/g) || [])).toHaveLength(2);
    expect((gallery.match(/enabled: false/g) || [])).toHaveLength(5);
    expect(gallery).toContain("مفعّل عند الطلب");
    expect(gallery).toContain("محفوظ للمستقبل");
    expect(specialists).toContain('@/assets/como/buraq.webp');
    expect(specialists).toContain('@/assets/como/farouq.webp');
  });

  it("gives the kitchen visual phase cards while keeping title-first drill-down", () => {
    expect(kitchen).toContain("function ExecutiveQueueCard");
    expect(kitchen).toContain("queuePhaseMeta");
    expect(kitchen).toContain("يحتاج مراجعتك");
    expect(kitchen).toContain("للتنفيذ الآن");
    expect(kitchen).toContain("بانتظار طرف خارجي");
    expect(kitchen).toContain("<ExecutiveQueueCard");
  });

  it("autoplays only Sara's local silent motion on page load", () => {
    expect(sara).toContain('@/assets/como/sara-idle.webm');
    expect(sara).toContain("autoPlay muted loop playsInline");
    expect(sara).toContain("الحركة المحلية تعمل تلقائيًا");
    expect(sara).not.toContain("createAvatarToken.mutateAsync");
  });
});
