import { useRef } from "react";
import * as THREE from "three";

export type ViewPreset = "front" | "right" | "left" | "top" | "bottom" | "iso";

export interface CameraApi {
  setView: (preset: ViewPreset) => void;
  fitBounds: (bounds: { min: [number, number, number]; max: [number, number, number] }, preset?: ViewPreset) => void;
  reset: () => void;
  zoom: (delta: number) => void;
}

/**
 * Shared handle between MeshViewer (writes) and the HUD (reads).
 * Initialised to no-ops; the in-Canvas <CameraApiBinder> populates it
 * once Three.js camera + controls are mounted.
 */
export function useCameraApiRef() {
  return useRef<CameraApi>({
    setView: () => {},
    fitBounds: () => {},
    reset: () => {},
    zoom: () => {},
  });
}

/** Distance from origin used by view presets. Tuned for skull meshes (~150mm). */
export const VIEW_DISTANCE = 280;

export const PRESET_POSITIONS: Record<ViewPreset, [number, number, number]> = {
  front:  [0, 50, VIEW_DISTANCE],
  right:  [VIEW_DISTANCE, 50, 0],
  left:   [-VIEW_DISTANCE, 50, 0],
  top:    [0, VIEW_DISTANCE, 0.1],
  bottom: [0, -VIEW_DISTANCE, 0.1],
  iso:    [VIEW_DISTANCE * 0.7, VIEW_DISTANCE * 0.6, VIEW_DISTANCE * 0.7],
};

export function applyView(camera: THREE.Camera, target: THREE.Vector3, preset: ViewPreset) {
  const [x, y, z] = PRESET_POSITIONS[preset];
  camera.position.set(x, y, z);
  camera.lookAt(target);
}

export function fitCameraToBounds(
  camera: THREE.Camera,
  controlsTarget: THREE.Vector3,
  bounds: { min: [number, number, number]; max: [number, number, number] },
  preset: ViewPreset = "front",
) {
  const box = new THREE.Box3(
    new THREE.Vector3(...bounds.min),
    new THREE.Vector3(...bounds.max),
  );
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.length() * 0.5, 1);
  const fov = camera instanceof THREE.PerspectiveCamera
    ? THREE.MathUtils.degToRad(camera.fov)
    : THREE.MathUtils.degToRad(45);
  const distance = Math.max(radius / Math.sin(fov / 2), radius * 2.2);
  const dir = new THREE.Vector3(...PRESET_POSITIONS[preset]).normalize();

  controlsTarget.copy(center);
  camera.position.copy(center).addScaledVector(dir, distance * 1.15);
  camera.lookAt(center);
}
