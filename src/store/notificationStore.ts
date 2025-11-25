import { create } from "zustand";

interface NotificationState {
  message: string | null;
  type: "success" | "error";
  show: (message: string, type?: "success" | "error") => void;
  hide: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  message: null,
  type: "success",
  show: (message, type = "success") => set({ message, type }),
  hide: () => set({ message: null }),
}));

