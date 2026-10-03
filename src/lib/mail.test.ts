import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ db: { user: { findMany: vi.fn(async () => []) } } }));

describe("notifyOwner", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    process.env.OWNER_NOTIFY_EMAIL = "owner@example.com, second@example.com";
    process.env.APP_URL = "https://casita.example";
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.RESEND_API_KEY;
    delete process.env.MAIL_FROM;
  });

  it("posts a well-formed email to Resend and escapes tenant-supplied text", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.MAIL_FROM = "Casita <alerts@casita.example>";
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { notifyOwner } = await import("./mail");
    await notifyOwner({ subject: "New request from Ana", lines: ["<script>alert(1)</script> leaking tap"], path: "/admin/maintenance/abc" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    const body = JSON.parse(init.body as string);
    expect(body.to).toEqual(["owner@example.com", "second@example.com"]);
    expect(body.from).toBe("Casita <alerts@casita.example>");
    expect(body.subject).toBe("[Casita de Juana] New request from Ana");
    expect(body.text).toContain("https://casita.example/admin/maintenance/abc");
    expect(body.html).not.toContain("<script>");
    expect(body.html).toContain("&lt;script&gt;");
  });

  it("does nothing without an API key", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { notifyOwner } = await import("./mail");
    await notifyOwner({ subject: "x", lines: ["y"], path: "/admin" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never throws if the mail service is down", async () => {
    process.env.RESEND_API_KEY = "re_test";
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const { notifyOwner } = await import("./mail");
    await expect(notifyOwner({ subject: "x", lines: ["y"], path: "/admin" })).resolves.toBeUndefined();
  });
});
