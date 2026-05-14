# Paso 6 — Malla FLAME base

**Anterior:** `step5.md` | **Siguiente:** `step7.md`

| | |
|---|---|
| Worker | `align_worker` (mismo task que paso 5) |
| Herramienta | FLAME `generic_model.pkl` |
| Entrada | — (sin parámetros del cráneo) |
| Salida | malla facial neutra (~5000 vértices) + 32 landmarks faciales |

## Qué hace

Instancia el modelo FLAME en estado completamente neutro para obtener la malla facial base sobre la que se aplicará la deformación TPS.

## Cómo se llama

```python
# backend/app/core/flame_loader.py — instanciado en startup del worker
verts, faces, landmarks = flame_model(
    shape_params=torch.zeros(1, 100),
    expression_params=torch.zeros(1, 50),
    pose_params=torch.zeros(1, 6),
)
```

FLAME se carga una vez en startup (`~140 MB`), no por cada job.

## Qué entrega

- Malla de ~5000 vértices topológicamente consistente
- 32 landmarks faciales predefinidos — subset compatible con protocolo Rhine & Campbell

## Regla crítica

**FLAME no recibe información del cráneo.** No infiere rasgos, no hace reconocimiento. Su único rol es proveer una geometría facial base con landmarks conocidos para que el paso 7 pueda alinearla.

## Licencia

Registro requerido en https://flame.is.tue.mpg.de — gratuito para uso académico.
El archivo `.pkl` no se commitea al repositorio. Se descarga manualmente en setup y se coloca en `backend/assets/flame/generic_model.pkl`.

## No hace

- No usa datos del cráneo
- No genera variantes (eso es responsabilidad del factor k en paso 5)
