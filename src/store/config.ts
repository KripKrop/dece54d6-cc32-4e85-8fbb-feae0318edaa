import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ConfigState {
  apiBaseUrl: string;
  apiKey: string;
  setApiBaseUrl: (url: string) => void;
  setApiKey: (key: string) => void;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      apiBaseUrl: "https://your-backend.com",
      apiKey: "",
      setApiBaseUrl: (url) => set({ apiBaseUrl: url.trim().replace(/\/?$/, "") }),
      setApiKey: (key) => set({ apiKey: key }),
    }),
    { name: "crunchy-config" }
  )
);
