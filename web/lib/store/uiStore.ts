import { create } from "zustand";
import { persist } from "zustand/middleware";

type ViewMode = "board" | "list";

interface UiState {
  selectedTaskId: string | null;
  viewMode: ViewMode;
  createOpen: boolean;
  createParentId: string | null;
  approvalTaskId: string | null;
  selectTask: (id: string | null) => void;
  setViewMode: (m: ViewMode) => void;
  openCreate: (parentId?: string | null) => void;
  closeCreate: () => void;
  openApproval: (id: string) => void;
  closeApproval: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      selectedTaskId: null,
      viewMode: "board",
      createOpen: false,
      createParentId: null,
      approvalTaskId: null,
      selectTask: (id) => set({ selectedTaskId: id }),
      setViewMode: (viewMode) => set({ viewMode }),
      openCreate: (parentId = null) =>
        set({ createOpen: true, createParentId: parentId }),
      closeCreate: () => set({ createOpen: false, createParentId: null }),
      openApproval: (id) => set({ approvalTaskId: id }),
      closeApproval: () => set({ approvalTaskId: null }),
    }),
    {
      name: "taskflow-ui",
      partialize: (s) => ({ viewMode: s.viewMode }),
    }
  )
);
