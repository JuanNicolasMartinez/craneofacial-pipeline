# Paso 3 — Selección de landmarks (manual)

**Anterior:** `step2.md` | **Siguiente:** `step4.md`

| | |
|---|---|
| Worker | — (acción del usuario en el browser) |
| Herramienta | Three.js `Raycaster` |
| Entrada | malla limpia en viewer 3D |
| Salida | 21 landmarks en DB (`landmark_sets` + `landmarks`) |

## Qué hace

El operador forense coloca manualmente 21 puntos anatómicos sobre la malla siguiendo el protocolo Rhine & Campbell (1980).

## Mecánica en el browser

Por cada clic sobre la malla, Three.js registra:
- `(x, y, z)` — coordenadas 3D del punto de intersección
- `(nx, ny, nz)` — normal unitaria de la cara del triángulo intersectado

La etiqueta del landmark activo viene de `frontend/src/features/landmarks/constants.ts`.

## Los 21 landmarks del protocolo usados por la app

```
supraglabella
glabella
nasion
end_of_nasal_bone
mid_philtrum
upper_lip_margin
lower_lip_margin
chin_lip_fold
mental_eminence
beneath_chin
right_supraorbital
right_suborbital
right_lateral_orbit
right_zygomatic_arch
right_zygomatic
right_masseter_muscle
right_gonion
right_supra_M2
right_occlusal_line
right_inferior_malar
temporal_fossa
```

Labels exactos: ver `frontend/src/features/landmarks/constants.ts`.

## Persistencia

```
PATCH /cases/{id}/landmarks
Body: [{ label, x, y, z, nx, ny, nz }, ...]   // 21 objetos
```

Validación backend: exactamente 21 landmarks, labels del protocolo.

## Reproducibilidad

Si se carga un segundo set del mismo caso, el sistema calcula y guarda la distancia euclidiana media entre sets en `landmark_sets.mean_inter_operator_dist_mm`.

## No hace

- No detecta landmarks automáticamente — es 100% manual
- No modifica la malla
