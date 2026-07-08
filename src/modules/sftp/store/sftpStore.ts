import { create } from "zustand";
import type { SftpProfile, SftpTransfer } from "@/modules/sftp/lib/types";

type SftpConnection = {
  id: string;
  profile: SftpProfile;
  fingerprint: string;
};

type SftpStore = {
  profiles: SftpProfile[];
  connection: SftpConnection | null;
  transfers: SftpTransfer[];
  setProfiles: (profiles: SftpProfile[]) => void;
  setConnection: (connection: SftpConnection | null) => void;
  upsertTransfer: (transfer: SftpTransfer) => void;
  clearCompleted: () => void;
};

export const useSftpStore = create<SftpStore>((set) => ({
  profiles: [],
  connection: null,
  transfers: [],
  setProfiles: (profiles) => set({ profiles }),
  setConnection: (connection) => set({ connection }),
  upsertTransfer: (transfer) =>
    set((state) => {
      const idx = state.transfers.findIndex((item) => item.id === transfer.id);
      if (idx === -1) return { transfers: [transfer, ...state.transfers] };
      const next = [...state.transfers];
      next[idx] = transfer;
      return { transfers: next };
    }),
  clearCompleted: () =>
    set((state) => ({
      transfers: state.transfers.filter(
        (item) => item.status === "queued" || item.status === "running",
      ),
    })),
}));
