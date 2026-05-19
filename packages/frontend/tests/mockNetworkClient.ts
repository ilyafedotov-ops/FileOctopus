import { vi } from "vitest";

export const mockNetworkClient = {
  listProfiles: vi.fn(async () => ({ profiles: [] })),
  connectionStatus: vi.fn(async () => ({ statuses: [] })),
  connect: vi.fn(async () => ({ ok: true })),
  disconnect: vi.fn(async () => ({ ok: true })),
  addProfile: vi.fn(async () => ({ profile: null })),
  updateProfile: vi.fn(async () => ({ profile: null })),
  deleteProfile: vi.fn(async () => ({ ok: true })),
  setSecret: vi.fn(async () => ({ ok: true })),
  validateUri: vi.fn(async () => ({ ok: true })),
};
