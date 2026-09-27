import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const home = readFileSync("client/src/pages/Home.tsx", "utf8");
const gallery = readFileSync("client/src/components/PreservedCapabilityGallery.tsx", "utf8");
const specialists = readFileSync("client/src/components/ComoNextSpecialistDesks.tsx", "utf8");
const kitchen = readFileSync("client/src/pages/ComoNextTodayPage.tsx", "utf8");
const sara = readFileSync("client/src/pages/SaraPage.tsx", "utf8");
const navigation = readFileSync("client/src/components/ComoPrimaryNav.tsx", "utf8");
const app = readFileSync("client/src/App.tsx", "utf8");
const projects = readFileSync("client/src/pages/ProjectManagementPage.tsx", "utf8");

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
    expect(kitchen).toContain("ما الذي يحتاج إنجازًا الآن؟");
  });

  it("opens Sara as an automatic live conversation with one approved visual identity", () => {
    expect(sara).toContain('@/assets/como/sara.webp');
    expect(sara).not.toContain('@/assets/como/sara-idle.webm');
    expect((sara.match(/<img src={saraPortrait}/g) || [])).toHaveLength(2);
    expect(sara).toContain("بعد التحقق تفتح سارة مباشرة");
    expect(sara).toContain("autoStart");
    expect(sara).toContain("streamlined");
  });

  it("uses one warm mobile navigation for the kitchen, projects, and Sara", () => {
    expect(navigation).toContain('active: PrimaryArea');
    expect(navigation).toContain('fixed inset-x-0 bottom-0');
    expect(navigation).toContain('saraPortrait');
    expect(kitchen).toContain('<ComoPrimaryNav active="kitchen" dark />');
    expect(app).toContain('<Redirect to="/como-next" />');
    expect(app).toContain('path="/gateway"');
  });

  it("presents project destinations as calm colored tiles instead of a monochrome list", () => {
    expect(projects).toContain("grid grid-cols-2 gap-3 lg:grid-cols-4");
    expect(projects).toContain("bg-cyan-50/85");
    expect(projects).toContain("bg-emerald-50/85");
    expect(projects).toContain("bg-amber-50/90");
    expect(projects).toContain("bg-violet-50/85");
  });
});
