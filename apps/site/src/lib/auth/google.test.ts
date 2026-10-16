import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyIdToken = vi.fn();
vi.mock("google-auth-library", () => ({ OAuth2Client: class { verifyIdToken = verifyIdToken; } }));

import { criarVerificadorGoogle } from "./google";

describe("criarVerificadorGoogle", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    vi.restoreAllMocks();
  });

  it("devolve a identidade quando o token é válido", async () => {
    verifyIdToken.mockResolvedValue({ getPayload: () => ({ email: "a@b.com", email_verified: true }) });
    expect(await criarVerificadorGoogle("id")("jwt")).toEqual({ email: "a@b.com", emailVerificado: true });
  });

  it("token recusado vira null e o log não contém o JWT nem o payload", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    verifyIdToken.mockRejectedValue(new Error("Invalid token signature: eyJsecreto.eyJpayload.assinatura"));
    expect(await criarVerificadorGoogle("id")("jwt")).toBeNull();
    expect(JSON.stringify(aviso.mock.calls)).not.toContain("eyJ");
  });

  it("falha ao buscar os certificados do Google é relançada (vira 502 no login)", async () => {
    verifyIdToken.mockRejectedValue(new Error("Failed to retrieve verification certificates: getaddrinfo ENOTFOUND"));
    await expect(criarVerificadorGoogle("id")("jwt")).rejects.toThrow("Failed to retrieve");
  });
});
