import { create } from "zustand";
import type { LandmarkIn, JobProgressMessage, CaseStep as ApiCaseStep } from "../api/types";

export type CaseStep = ApiCaseStep;

interface SelectCaseInput {
  id: string;
  ref: string;
  status: string;
}

interface HydrationInput {
  currentStep: CaseStep;
  meshUrl: string | null;
  meshFormat: "ply" | "obj" | "stl" | null;
  landmarkSetId: string | null;
  landmarks: LandmarkIn[];
  hasBioProfile: boolean;
  lastJobId: string | null;
  lastJobStatus: string | null;
}

interface JobStore {
  activeCaseId: string | null;
  activeCaseRef: string | null;
  activeCaseStatus: string | null;
  activeStep: CaseStep;
  activeMeshUrl: string | null;
  activeMeshFormat: "ply" | "obj" | "stl" | null;
  activeLandmarkSetId: string | null;
  activeJobId: string | null;
  hasBioProfile: boolean;
  pipelineStep: number;
  landmarksInProgress: LandmarkIn[];
  stepProgress: Record<number, JobProgressMessage>;
  // UI preference: 1.0 = default sphere radius, 0.05 – 3.0 range.
  landmarkSize: number;

  selectCase: (input: SelectCaseInput) => void;
  setActiveCaseId: (id: string | null) => void;
  setActiveStep: (step: CaseStep) => void;
  setActiveMesh: (url: string, format: "ply" | "obj" | "stl") => void;
  setActiveLandmarkSetId: (id: string) => void;
  setActiveJobId: (id: string | null) => void;
  setHasBioProfile: (v: boolean) => void;
  setLandmarkSize: (v: number) => void;
  applyHydration: (h: HydrationInput) => void;
  clearActiveCase: () => void;
  addLandmark: (lm: LandmarkIn) => void;
  removeLandmark: (label: string) => void;
  resetLandmarks: () => void;
  applyProgressMessage: (msg: JobProgressMessage) => void;
  resetJobProgress: () => void;
  reset: () => void;
}

const INITIAL_STEP: CaseStep = "mesh";

const LANDMARK_SIZE_KEY = "craneo:landmark-size";
const LANDMARK_SIZE_MIN = 0.05;
const LANDMARK_SIZE_MAX = 3.0;

function loadLandmarkSize(): number {
  if (typeof window === "undefined") return 1.0;
  const raw = window.localStorage.getItem(LANDMARK_SIZE_KEY);
  const n = raw ? parseFloat(raw) : NaN;
  return Number.isFinite(n) && n >= LANDMARK_SIZE_MIN && n <= LANDMARK_SIZE_MAX
    ? n
    : 1.0;
}

export const useJobStore = create<JobStore>((set) => ({
  activeCaseId: null,
  activeCaseRef: null,
  activeCaseStatus: null,
  activeStep: INITIAL_STEP,
  activeMeshUrl: null,
  activeMeshFormat: null,
  activeLandmarkSetId: null,
  activeJobId: null,
  hasBioProfile: false,
  pipelineStep: 0,
  landmarksInProgress: [],
  stepProgress: {},
  landmarkSize: loadLandmarkSize(),

  selectCase: ({ id, ref, status }) =>
    set({
      activeCaseId: id,
      activeCaseRef: ref,
      activeCaseStatus: status,
      // Clear stale per-case state; real values arrive via applyHydration
      activeStep: INITIAL_STEP,
      activeMeshUrl: null,
      activeMeshFormat: null,
      activeLandmarkSetId: null,
      activeJobId: null,
      hasBioProfile: false,
      pipelineStep: 0,
      landmarksInProgress: [],
      stepProgress: {},
    }),
  setActiveCaseId: (id) => set({ activeCaseId: id }),
  setActiveStep: (step) => set({ activeStep: step }),
  setActiveMesh: (url, format) => set({ activeMeshUrl: url, activeMeshFormat: format }),
  setActiveLandmarkSetId: (id) => set({ activeLandmarkSetId: id }),
  setActiveJobId: (id) => set({ activeJobId: id }),
  setHasBioProfile: (v) => set({ hasBioProfile: v }),
  setLandmarkSize: (v) => {
    const clamped = Math.max(LANDMARK_SIZE_MIN, Math.min(LANDMARK_SIZE_MAX, v));
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANDMARK_SIZE_KEY, String(clamped));
    }
    set({ landmarkSize: clamped });
  },
  applyHydration: (h) =>
    set((s) => ({
      activeStep: h.currentStep,
      // Don't overwrite a live blob URL with a backend URL (mesh already loaded)
      activeMeshUrl: s.activeMeshUrl ?? h.meshUrl,
      activeMeshFormat: h.meshFormat,
      activeLandmarkSetId: h.landmarkSetId,
      landmarksInProgress: h.landmarks.length > 0 ? h.landmarks : s.landmarksInProgress,
      hasBioProfile: h.hasBioProfile,
      // Don't clobber an in-flight job with a stale hydration result.
      // If store already has a job ID, keep it; otherwise use backend's last job
      // only if it is actually running.
      activeJobId:
        s.activeJobId !== null
          ? s.activeJobId
          : h.lastJobStatus === "running"
            ? h.lastJobId
            : null,
    })),
  clearActiveCase: () =>
    set({
      activeCaseId: null,
      activeCaseRef: null,
      activeCaseStatus: null,
      activeStep: INITIAL_STEP,
      activeMeshUrl: null,
      activeMeshFormat: null,
      activeLandmarkSetId: null,
      activeJobId: null,
      hasBioProfile: false,
      pipelineStep: 0,
      landmarksInProgress: [],
      stepProgress: {},
    }),
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
  resetJobProgress: () =>
    set({
      activeJobId: null,
      pipelineStep: 0,
      stepProgress: {},
    }),
  reset: () =>
    set({
      activeJobId: null,
      pipelineStep: 0,
      landmarksInProgress: [],
      stepProgress: {},
    }),
}));
