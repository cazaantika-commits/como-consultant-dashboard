import { describe, it, expect } from "vitest";

describe("Email Credentials Validation", () => {
  it("should have EMAIL_PASSWORD configured", () => {
    const password = process.env.EMAIL_PASSWORD;
    expect(password).toBeDefined();
    expect(password!.length).toBeGreaterThan(0);
  });

  it("should have EMAIL_HOST configured", () => {
    const host = process.env.EMAIL_HOST;
    expect(host).toBeDefined();
    expect(host!.length).toBeGreaterThan(0);
  });

  it("should have EMAIL_USER configured", () => {
    const user = process.env.EMAIL_USER;
    expect(user).toBeDefined();
    expect(user!).toContain("@");
  });

  it("should connect to SMTP server with credentials", async () => {
    // Dynamic import to avoid vite resolution issues
    const nodemailer = await import("nodemailer");
    const host = process.env.EMAIL_HOST || "mail.privateemail.com";
    const user = process.env.EMAIL_USER || "a.zaqout@comodevelopments.com";
    const password = process.env.EMAIL_PASSWORD;

    const transporter = nodemailer.default.createTransport({
      host: host,
      port: 465,
      secure: true,
      auth: {
        user: user,
        pass: password!,
      },
    });

    const verified = await transporter.verify();
    expect(verified).toBe(true);
  }, 15000);
});
