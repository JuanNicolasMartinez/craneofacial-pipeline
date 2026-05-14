// Rhine & Campbell (1980) protocol — 21 anatomical landmarks for craniofacial reconstruction.
// Labels must match backend/app/core/fstt.py LANDMARK_LABELS exactly.

export interface LandmarkDefinition {
  label: string;
  description: string;
  flameIndex: number | null; // FLAME mesh vertex index for the neutral base mesh (null = not yet mapped)
}

export const RHINE_CAMPBELL_LANDMARKS: LandmarkDefinition[] = [
  { label: "supraglabella",          description: "Above the glabella, at the midline of the frontal bone",            flameIndex: null },
  { label: "glabella",               description: "Most anterior point of the forehead between the brow ridges",        flameIndex: null },
  { label: "nasion",                 description: "Nasofrontal suture at the midline",                                  flameIndex: null },
  { label: "end_of_nasal_bone",      description: "Inferior end of the nasal bones at the midline",                    flameIndex: null },
  { label: "mid_philtrum",           description: "Midpoint of the philtrum on the upper lip skin",                    flameIndex: null },
  { label: "upper_lip_margin",       description: "Upper lip margin at the midline",                                   flameIndex: null },
  { label: "lower_lip_margin",       description: "Lower lip margin at the midline",                                   flameIndex: null },
  { label: "chin_lip_fold",          description: "Labiomental crease between lower lip and chin",                     flameIndex: null },
  { label: "mental_eminence",        description: "Most anterior point of the chin eminence",                          flameIndex: null },
  { label: "beneath_chin",           description: "Inferior border of the mandibular symphysis",                       flameIndex: null },
  { label: "right_supraorbital",     description: "Above the right orbit at the mid-pupillary line",                   flameIndex: null },
  { label: "right_suborbital",       description: "Below the right orbit at the mid-pupillary line",                   flameIndex: null },
  { label: "right_lateral_orbit",    description: "Lateral margin of the right orbit",                                 flameIndex: null },
  { label: "right_zygomatic_arch",   description: "Mid-point of the right zygomatic arch",                             flameIndex: null },
  { label: "right_zygomatic",        description: "Most lateral point of the right zygoma",                            flameIndex: null },
  { label: "right_masseter_muscle",  description: "Belly of the right masseter muscle over the mandibular ramus",      flameIndex: null },
  { label: "right_gonion",           description: "Angle of the right mandible",                                       flameIndex: null },
  { label: "right_supra_M2",         description: "Buccal surface above the right second molar",                       flameIndex: null },
  { label: "right_occlusal_line",    description: "Occlusal plane at the right second molar",                          flameIndex: null },
  { label: "right_inferior_malar",   description: "Inferior margin of the right malar bone",                           flameIndex: null },
  { label: "temporal_fossa",         description: "Deepest point of the right temporal fossa",                         flameIndex: null },
];

export const LANDMARK_COUNT = RHINE_CAMPBELL_LANDMARKS.length; // 21
