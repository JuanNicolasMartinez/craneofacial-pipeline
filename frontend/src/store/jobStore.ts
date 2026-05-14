import { create } from "zustand";
import type { LandmarkIn, JobProgressMessage } from "../api/types";

export type CaseStep = "mesh" | "landmarks" | "pipeline" | "result";

interface JobStore {
  activeCaseId: string | null;
  activeCaseRef: string | null;
  activeCaseStatus: string | null;
  activeStep: CaseStep;
  activeMeshUrl: string | null;
  activeMeshFormat: "ply" | "obj" | "stl" | null;
  activeLandmarkSetId: string | null;
  activeJobId: string | null;
  pipelineStep: number;
  landmarksInProgress: LandmarkIn[];
  stepProgress: Record<number, JobProgressMessage>;

  setActiveCase: (id: string, ref: string, status: string) => void;
  setActiveCaseId: (id: string | null) => void;
  setActiveStep: (step: CaseStep) => void;
  setActiveMesh: (url: string, format: "ply" | "obj" | "stl") => void;
  setActiveLandmarkSetId: (id: string) => void;
  setActiveJobId: (id: string | null) => void;
  addLandmark: (lm: LandmarkIn) => void;
  removeLandmark: (label: string) => void;
  resetLandmarks: () => void;
  applyProgressMessage: (msg: JobProgressMessage) => void;
  reset: () => void;
}

export const useJobStore = create<JobStore>((set) => ({
  activeCaseId: null,
  activeCaseRef: null,
  activeCaseStatus: null,
  activeStep: "mesh",
  activeMeshUrl: null,
  activeMeshFormat: null,
  activeLandmarkSetId: null,
  activeJobId: null,
  pipelineStep: 0,
  landmarksInProgress: [],
  stepProgress: {},

  setActiveCase: (id, ref, status) =>
    set({ activeCaseId: id, activeCaseRef: ref, activeCaseStatus: status, activeStep: "mesh" }),
  setActiveCaseId: (id) => set({ activeCaseId: id }),
  setActiveStep: (step) => set({ activeStep: step }),
  setActiveMesh: (url, format) => set({ activeMeshUrl: url, activeMeshFormat: format }),
  setActiveLandmarkSetId: (id) => set({ activeLandmarkSetId: id }),
  setActiveJobId: (id) => set({ activeJobId: id }),
  addLandmark: (lm) =>
    set((s) => {
      const existing = s.landmarksInProgress.findIndex((l) => l.label === lm.label);
      if (existing >= 0) {
        const updated = [...s.landmarksInProgress];
        updated[existing] = lm;
        return { landmarksInProgress: updated };
      }
      return { landmarksInProgress: [...s.landmarksInProgress, lm] };
    }),
  removeLandmark: (label) =>
    set((s) => ({ landmarksInProgress: s.landmarksInProgress.filter((l) => l.label !== label) })),
  resetLandmarks: () => set({ landmarksInProgress: [] }),
  applyProgressMessage: (msg) =>
    set((s) => ({
      stepProgress: { ...s.stepProgress, [msg.step]: msg },
      pipelineStep: msg.step,
    })),
  reset: () =>
    set({
      activeJobId: null,
      pipelineStep: 0,
      landmarksInProgress: [],
      stepProgress: {},
    }),
}));
