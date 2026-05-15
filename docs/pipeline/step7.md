# Paso 7 — Alineación cráneo–cara

**Anterior:** `step6.md` | **Siguiente:** `step8.md`

| | |
|---|---|
| Worker | `align_worker` (mismo task que pasos 5 y 6) |
| Herramienta | Procrustes / Umeyama con SVD (`numpy.linalg.svd`) |
| Entrada | malla FLAME base + puntos de control faciales (paso 5) |
| Salida | malla FLAME transformada al sistema de referencia del cráneo |

## Qué hace

Lleva la malla FLAME al sistema de coordenadas del cráneo mediante una
transformación de similitud: traslación + rotación + escala uniforme. Antes de
la deformación libre, el backend ajusta la forma dentro del espacio paramétrico
FLAME (`shapedirs`) con regularización fuerte, para que la cara base siga siendo
humana.

La alineación rígida no usa los 21 landmarks completos sino un subconjunto
estable de 14 puntos anatómicos. Ese subconjunto se estima con rechazo robusto
de outliers: si un landmark está mal colocado o la correspondencia FLAME es mala,
no debe arrastrar toda la cara. En Forense v1, este ajuste es parte de una
energía conservadora:

```
E = forma_FLAME + ajuste_landmarks + FSTT + suavidad + plausibilidad
```

FLAME tiene prioridad como forma humana; FSTT y landmarks actúan como
observaciones anatómicas con confianza y tolerancia.

## Operaciones

1. Construir correspondencias rígidas:
   `supraglabella`, `glabella`, `nasion`, `end_of_nasal_bone`,
   `mental_eminence`, `beneath_chin`, `right_supraorbital`,
   `right_suborbital`, `right_lateral_orbit`, `right_zygomatic_arch`,
   `right_zygomatic`, `right_masseter_muscle`, `right_gonion`,
   `temporal_fossa`
2. Estimar la transformación óptima con SVD:
```python
scale, rotation, translation = estimate_similarity_transform(
    flame_landmarks_rigid,
    face_ctrl_rigid,
)
```
3. Rechazar outliers de forma determinística y refitar con los inliers
4. Ajustar un subconjunto conservador de componentes FLAME con pérdida robusta y prior fuerte
5. Aplicar la transformación a todos los vértices de la malla FLAME ajustada
6. Registrar residuales rígidos completos y robustos para trazabilidad

## Salida

- Malla FLAME paramétrica transformada al espacio del paciente
- Parámetros de similitud (`scale`, `rotation`, `translation`) listos para el paso 8
- Diagnósticos de prealineación rígida, outliers, pesos robustos y confianza

Pasa en memoria al paso 8.

## No hace

- No deforma la malla (eso es paso 8)
- No modifica el cráneo
