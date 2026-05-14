import { create } from "zustand";
import type { LandmarkIn, JobProgressMessage } from "../api/types";

interface JobStore {
  activeCaseId: string | null;
  activeJobId: string | null;
  activeStep: number;
  landmarksInProgress: LandmarkIn[];
  stepProgress: Record<number, JobProgressMessage>;

  setActiveCaseId: (id: string | null) => void;
  setActiveJobId: (id: string | null) => void;
  setActiveStep: (step: number) => void;
  addLandmark: (lm: LandmarkIn) => void;
  resetLandmarks: () => void;
  applyProgressMessage: (msg: JobProgressMessage) => void;
  reset: () => void;
}

export const useJobStore = create<JobStore>((set) => ({
  activeCaseId: null,
  activeJobId: null,
  activeStep: 0,
  landmarksInProgress: [],
  stepProgress: {},

  setActiveCaseId: (id) => set({ activeCaseId: id }),
  setActiveJobId: (id) => set({ activeJobId: id }),
  setActiveStep: (step) => set({ activeStep: step }),
  addLandmark: (lm) =>
    set((s) => ({ landmarksInProgress: [...s.landmarksInProgress, lm] })),
  resetLandmarks: () => set({ landmarksInProgress: [] }),
  applyProgressMessage: (msg) =>
    set((s) => ({
      stepProgress: { ...s.stepProgress, [msg.step]: msg },
      activeStep: msg.step,
    })),
  reset: () =>
    set({
      activeJobId: null,
      activeStep: 0,
      landmarksInProgress: [],
      stepProgress: {},
    }),
}));
