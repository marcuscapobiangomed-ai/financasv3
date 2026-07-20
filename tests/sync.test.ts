import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FinanceState } from "../lib/types";

// --------------------------------------------------------------------------
// Inicializar os mocks com vi.hoisted para evitar o problema de hoisting
// --------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { goal: 1000000 }, error: null });
  const mockIn = vi.fn().mockResolvedValue({ data: [], error: null });
  const mockIs = vi.fn().mockReturnValue({ data: [], error: null });
  const mockEq = vi.fn().mockReturnThis();
  const mockUpdate = vi.fn().mockReturnThis();
  const mockUpsert = vi.fn().mockResolvedValue({ data: [], error: null });
  const mockSelect = vi.fn().mockReturnThis();

  const mockFrom = vi.fn().mockReturnValue({
    select: mockSelect,
    upsert: mockUpsert,
    update: mockUpdate,
    eq: mockEq,
    is: mockIs,
    in: mockIn,
    maybeSingle: mockMaybeSingle,
  });

  return { mockFrom, mockUpsert, mockIs, mockEq, mockMaybeSingle, mockSelect, mockIn };
});

vi.mock("../lib/supabase", () => ({
  supabase: { from: mocks.mockFrom },
}));

import { SupabaseFinanceRepository } from "../lib/storage/supabase-repository";
import { LocalStorageRepository } from "../lib/storage/local-storage-repository";

const USER_A = "user-a-uuid-0001";
const USER_B = "user-b-uuid-0002";

const baseState: FinanceState = {
  schemaVersion: 4,
  goal: 10000,
  accounts: [{ id: "wallet", name: "Carteira", type: "cash", balance: 500, available: true }],
  entries: [],
  invoices: [],
  updatedAt: new Date().toISOString(),
};

// --------------------------------------------------------------------------
// Sprint 4.7 — Testes de Segurança, RLS e Sincronização
// --------------------------------------------------------------------------
describe("RLS e Isolamento de Usuários", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockMaybeSingle.mockResolvedValue({ data: { goal: 1000000 }, error: null });
    mocks.mockIs.mockResolvedValue({ data: [], error: null });
    mocks.mockUpsert.mockResolvedValue({ data: [], error: null });
    mocks.mockEq.mockReturnThis();
    mocks.mockFrom.mockReturnValue({
      select: mocks.mockSelect,
      upsert: mocks.mockUpsert,
      update: vi.fn().mockReturnThis(),
      eq: mocks.mockEq,
      is: mocks.mockIs,
      in: mocks.mockIn,
      maybeSingle: mocks.mockMaybeSingle,
    });
  });

  it("Usuário A e Usuário B possuem repositórios isolados por userId", () => {
    const repoA = new SupabaseFinanceRepository(USER_A);
    const repoB = new SupabaseFinanceRepository(USER_B);
    expect(repoA.userId).toBe(USER_A);
    expect(repoB.userId).toBe(USER_B);
    expect(repoA.userId).not.toBe(repoB.userId);
  });

  it("saveState para USER_A envia upsert sem user_id de USER_B", async () => {
    const repo = new SupabaseFinanceRepository(USER_A);
    await repo.saveState(baseState);

    const upsertCalls = mocks.mockUpsert.mock.calls;
    const anyCallWithWrongUser = upsertCalls.some((call: any) => {
      const payload = Array.isArray(call[0]) ? call[0] : [call[0]];
      return payload.some((row: any) => row.user_id && row.user_id !== USER_A);
    });
    expect(anyCallWithWrongUser).toBe(false);
  });
});

describe("Arredondamento de centavos no Supabase Repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockMaybeSingle.mockResolvedValue({ data: { goal: 1000000 }, error: null });
    mocks.mockIs.mockResolvedValue({ data: [], error: null });
    mocks.mockUpsert.mockResolvedValue({ data: [], error: null });
    mocks.mockEq.mockReturnThis();
    mocks.mockFrom.mockReturnValue({
      select: mocks.mockSelect,
      upsert: mocks.mockUpsert,
      update: vi.fn().mockReturnThis(),
      eq: mocks.mockEq,
      is: mocks.mockIs,
      in: mocks.mockIn,
      maybeSingle: mocks.mockMaybeSingle,
    });
  });

  it("Converte saldo de conta para centavos no upsert", async () => {
    const state: FinanceState = {
      ...baseState,
      accounts: [{ id: "wallet", name: "Carteira", type: "cash", balance: 123.45, available: true }],
    };
    const repo = new SupabaseFinanceRepository(USER_A);
    await repo.saveState(state);

    const allPayloads = mocks.mockUpsert.mock.calls.flatMap((call: any) =>
      Array.isArray(call[0]) ? call[0] : [call[0]]
    );
    const accountRow = allPayloads.find((row: any) => row?.balance_cents !== undefined);
    expect(accountRow?.balance_cents).toBe(12345);
  });

  it("Converte meta para centavos no perfil", async () => {
    const state: FinanceState = { ...baseState, goal: 10000 };
    const repo = new SupabaseFinanceRepository(USER_A);
    await repo.saveState(state);

    const allPayloads = mocks.mockUpsert.mock.calls.flatMap((call: any) =>
      Array.isArray(call[0]) ? call[0] : [call[0]]
    );
    const profileRow = allPayloads.find((row: any) => row?.goal !== undefined);
    expect(profileRow?.goal).toBe(1000000); // R$ 10.000 = 1.000.000 centavos
  });
});

describe("Fallback para LocalStorage quando offline", () => {
  it("loadState retorna estado com entries array mesmo sem dados armazenados", async () => {
    const repo = new LocalStorageRepository();
    const state = await repo.loadState();
    expect(state).toBeDefined();
    expect(Array.isArray(state.entries)).toBe(true);
  });

  it("saveState não lança exceção mesmo sem window disponível", async () => {
    const repo = new LocalStorageRepository();
    await expect(repo.saveState(baseState)).resolves.not.toThrow();
  });
});
