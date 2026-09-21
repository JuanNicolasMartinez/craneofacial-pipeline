# OVERVIEW.md

Resumen de todo lo que hay en `docs/`: qué hace la aplicación, cómo funciona por
dentro y dónde está documentado cada detalle.

Este documento es un mapa, no un reemplazo. Cuando necesites el detalle, el
archivo específico manda.

---

## 1. Qué es

Un sistema de **reconstrucción craneofacial 3D asistida** para contexto forense.
Entra un cráneo digitalizado (`.ply`, `.obj`, `.stl`) y sale una aproximación
geométrica del rostro, acompañada de una puntuación de confianza y de los motivos
por los que desconfiar de ella.

Desarrollado por el Semillero NeuroMinds (Universidad Externado de Colombia) en
colaboración con la UBPD.

**La premisa que ordena todo el diseño**, de `concepts/contexto-conceptual-del-problema-y-procedimiento.md`:

> El cráneo no contiene una "cara completa" codificada de forma determinista.

Hay partes del rostro que el hueso no determina —grosor de mejilla, forma fina de
labios, cartílago nasal, tejido periorbitario—. Por eso el sistema **no vende
certeza**: produce una aproximación humana, trazable y metodológicamente honesta.

Los resultados son **hipótesis visuales, no identificaciones positivas**. No hay
lógica de identificación biométrica en el sistema y no debe añadirse.

### Las tres fuentes de información

Ninguna manda sobre las otras; el sistema las equilibra:

| Fuente | Aporta | Riesgo si mandara sola |
|---|---|---|
| **Landmarks** manuales sobre el cráneo | Anclaje anatómico real | Un punto mal marcado deforma la cara |
| **FSTT** según perfil biológico | Profundidad de tejido blando | Combinaciones de espesores que nadie tiene |
| **FLAME** como *prior* de forma | Que el resultado siga pareciendo una cara | Regresión hacia la cara promedio |

---

## 2. El recorrido del usuario

```
Registro / login
  → crear caso forense
  → subir la malla del cráneo
  → colocar 21 landmarks sobre la malla en el visor 3D
  → declarar el perfil biológico (sexo, edad, ancestría)
  → ejecutar el pipeline
  → seguir los 9 pasos en vivo por WebSocket
  → descargar el .ply y el params.json
```

Cada caso pertenece a un usuario y **solo es visible para su dueño**: un caso
ajeno responde `404`, nunca `403` (no se revela que existe). Detalle en
`arquitecture/AUTH.md`.

---

## 3. El pipeline de 9 pasos

Es el corazón del sistema. Cada paso tiene su archivo en `pipeline/step1.md` …
`step9.md`; el índice está en `pipeline/README.md`.

| # | Paso | Dónde corre | Herramienta |
|---|---|---|---|
| 1 | Ingesta del cráneo | Router FastAPI (síncrono) | `UploadFile` |
| 2 | Preprocesamiento geométrico | `mesh_worker` | `trimesh` |
| 3 | **Selección de landmarks** | Navegador (manual) | Three.js `Raycaster` |
| 4 | **Perfil biológico** | Formulario (manual) | FastAPI |
| 5 | Vectores FSTT | `align_worker` | `core/fstt.py` |
| 6 | Malla FLAME base | `align_worker` | `generic_model.pkl` |
| 7 | Alineación cráneo–cara | `align_worker` | Procrustes / SVD |
| 8 | Deformación TPS | `tps_worker` | SciPy `RBFInterpolator` |
| 9 | Exportación y trazabilidad | `export_worker` | `trimesh` |

Los pasos **3 y 4 son manuales** y no forman parte de la cadena Celery: el
pipeline se lanza cuando ya existen landmarks y perfil.

```
sube malla → step1 → step2 → [manual: 3, 4] → step5+6+7 → step8 → step9
```

### Qué pasa realmente en cada etapa

**Pasos 1–2 · preparar la malla.** Se valida y persiste el archivo, y se
canonicaliza a PLY: se eliminan caras degeneradas y vértices sueltos, y se
recalculan normales. Deliberadamente **no** se cambia la escala ni el sistema de
coordenadas, porque los landmarks ya colocados deben seguir apuntando al mismo
espacio 3D.

**Paso 3 · los 21 landmarks.** El operador marca a mano los puntos del protocolo
**Rhine & Campbell (1980)**. Cada clic registra la posición `(x,y,z)` y la normal
`(nx,ny,nz)` de la cara intersectada. Esa normal es la dirección en la que luego
se empuja el tejido — de ahí que importe tanto.

**Paso 4 · perfil biológico.** Sexo, edad y ancestría estimados por el operador.
Determinan qué valores FSTT se aplican.

**Paso 5 · de cráneo a cara.** La ecuación que sostiene todo el método:

```
p_facial_i = p_craneal_i + d_i · n_i
```

Cada landmark craneal se desplaza hacia afuera una distancia `d_i` (el grosor de
tejido blando de ese punto) siguiendo su normal. El resultado son 21 puntos de
control faciales. **Son observaciones estadísticas, no coordenadas obligatorias**:
guían la reconstrucción sin forzar a FLAME a pasar exactamente por cada una.

**Paso 6 · la cara base.** Se instancia FLAME en estado completamente neutro
(~5000 vértices). No se infiere nada del cráneo aquí: es una plantilla humana.

**Paso 7 · alineación.** Transformación de similitud (traslación + rotación +
escala) que lleva FLAME al sistema de coordenadas del cráneo. No usa los 21
puntos sino un **subconjunto estable de 14 landmarks** anclados a hueso
identificable, con rechazo robusto de atípicos: un punto mal marcado no arrastra
la pose del modelo completo.

**Paso 8 · deformación TPS.** Corrección residual local sobre la FLAME ya
ajustada. Cada landmark recibe un peso según su residual, una tolerancia FSTT y
una confianza por región anatómica; los atípicos influyen poco en vez de doblar
la cara. El desplazamiento se localiza cerca de los landmarks y se acota por
vértice para que el TPS no pueda rehacer la cabeza entera.

**Paso 9 · exportación.** Persiste el `.ply` final y un `params.json` con todo lo
necesario para reproducir y auditar el resultado.

---

## 4. La idea que distingue al método: degradar en vez de fingir

Esto es lo que conviene entender antes que ningún detalle técnico.

Si la evidencia es mala, **el sistema no aborta ni entrega una cara segura de sí
misma: entrega menos ajuste y lo declara.**

El paso 9 no produce un resultado sino cinco candidatos, mezclando la deformación
TPS con un factor `alpha`:

```
alpha:  1.00  →  0.65  →  0.40  →  0.20  →  0.00
        más ajuste a los landmarks  …  más conservación de FLAME
```

Cada candidato pasa una validación geométrica y una de forma humana. Se exporta
el primero que pase ambas. Si ninguno pasa, se exporta `alpha = 0.0`: FLAME
simplemente alineado, sin deformación, marcado como `fallback`.

### Los tres estados

| Estado | Cuándo | Qué significa |
|---|---|---|
| `ok` | `confidence_score ≥ 0.72` **y** `alpha ≥ 0.65` | El ajuste completo resultó estable |
| `degraded` | Cualquier otro caso exportable | Hubo que limitar parte del ajuste |
| `fallback` | El blend final quedó en `alpha = 0.0` | Se quedó cerca de FLAME alineado para no romper la forma |

El `confidence_score` (entre 0.05 y 1) descuenta por residual rígido alto, error
de landmark tras el TPS, haber tenido que degradar, y pesos medios bajos. Va
acompañado de **motivos legibles** del tipo «residual rígido medio alto (5,12 mm)»
o «landmarks de baja confianza: temporal_fossa».

> **No es la probabilidad de que la cara sea correcta.** Es una medida interna de
> estabilidad geométrica del pipeline. Sirve para decidir cuánto fiarse, no para
> afirmar un porcentaje de acierto.

Detalle completo en `concepts/parametros-warning-y-flame-map.md`, que además
explica dos cosas que se confunden a menudo:

- **Confianza del operador** (cuán seguro estaba quien marcó los puntos) ≠
  **`confidence_score`** (estabilidad geométrica medida por el backend).
- **Factor `k` de corpulencia**: ajuste exploratorio del FSTT, no un parámetro
  calibrado con datos.

---

## 5. Arquitectura

### Las seis piezas

```
                 ┌───────────┐
   navegador ───▶│ frontend  │  SPA estática (React + Three.js)
       │         └───────────┘
       │  HTTP + WebSocket
       ▼
   ┌───────┐   encola    ┌────────┐
   │  api  │────────────▶│ Redis  │◀──── publica progreso ────┐
   └───┬───┘             └────────┘                           │
       │ SQL                  │ consume tareas          ┌──────┴───┐
       ▼                      └─────────────────────────│  worker  │
   ┌──────────┐                                         └────┬─────┘
   │ Postgres │◀───────────── SQL ──────────────────────────-┘
   └──────────┘
       ▲                                        ┌────────────────┐
       └──── api y worker leen/escriben ───────▶│ almacenamiento │
                  archivos (API S3)             │   de objetos   │
                                                └────────────────┘
```

| Pieza | Qué es |
|---|---|
| `api` | FastAPI: REST + WebSocket. Aplica las migraciones al arrancar |
| `worker` | Celery: ejecuta el pipeline. Misma imagen que `api` |
| `frontend` | SPA estática de React/Vite (`dist/`) |
| Postgres | Base de datos relacional (≥ 14) |
| Redis | Broker de Celery **y** canal pub/sub del WebSocket |
| Almacenamiento | Mallas y resultados, vía API compatible con S3 |

### Stack y por qué

De `arquitecture/STACK.md`, que justifica cada elección y dice qué descarta:

- **FastAPI** — async nativo, validación Pydantic, OpenAPI gratis, WebSocket
  incluido. Flask descartado por falta de async; Django por overhead.
- **Celery + Redis** — el pipeline tarda 30–120 s. `BackgroundTasks` de FastAPI
  no tiene reintentos, visibilidad de estado ni colas separadas. Tres colas:
  `mesh_queue` (I/O), `compute_queue` (CPU), `export_queue` (I/O liviano).
- **SQLAlchemy 2.0 async + Alembic** — nunca `create_all()` en producción.
- **React + React Three Fiber** — wrapper idiomático de Three.js. Babylon.js
  descartado.
- **TanStack Query** para estado del servidor, **Zustand** para estado de UI.
  No se mezclan.
- **FLAME** — único modelo paramétrico facial open-source con topología
  consistente y landmarks compatibles con Rhine & Campbell. Requiere registro
  académico gratuito; el `.pkl` no se commitea.
- **SciPy `RBFInterpolator`** con `kernel='thin_plate_spline'` — es exactamente
  φ(r) = r² log(r).
- **GraphQL descartado**: el dominio es lineal y los endpoints predecibles.

### Contrato frontend–backend

El **schema OpenAPI de FastAPI manda**. Los tipos TypeScript se generan desde él
(`pnpm generate-types`); no se escriben a mano.

```
POST   /auth/register | /auth/login | /auth/logout
GET    /auth/me
POST   /cases                          crear caso
POST   /cases/{id}/mesh                subir cráneo
PATCH  /cases/{id}/landmarks           guardar los 21 landmarks
PATCH  /cases/{id}/biological-profile  perfil biológico
POST   /cases/{id}/pipeline/run        lanzar pipeline → 202 + job_id
GET    /cases/{id}/result              URLs del resultado
WS     /ws/jobs/{job_id}               progreso en vivo
```

El WebSocket es de **solo salida**: el worker publica en Redis, la API empuja al
cliente. El cliente nunca hace polling.

---

## 6. Modelo de datos

Nueve tablas (`arquitecture/DB.md` tiene columnas y tipos):

```
User ──── Case ──┬── Mesh                 malla del cráneo
                 ├── BiologicalProfile    1:1, determina el FSTT
                 ├── LandmarkSet ──── Landmark   (21 por set)
                 └── PipelineJob ──┬── JobStep        (9 por job)
                                   └── Reconstruction  resultado
```

- Un caso puede tener **varios jobs** (re-ejecuciones, variantes de parámetros).
- `JobStep` guarda el estado de cada uno de los 9 pasos, su duración y sus
  `params` — es la base de la trazabilidad.
- Los archivos pesados **no** van a la base: se guardan en el almacenamiento de
  objetos y en la DB solo queda la clave.

---

## 7. Autenticación

De `arquitecture/AUTH.md`:

- Registro y login propios. **Sin login con redes sociales.**
- Contraseñas con **bcrypt**, mínimo 8 caracteres. Nunca se almacena ni se
  loguea la contraseña en claro.
- **JWT HS256** cuyo payload es el `id` del usuario y su expiración.
- El token viaja en una **cookie `HttpOnly`**, nunca en `localStorage`:
  JavaScript no puede leerla, lo que la hace inmune al robo por XSS. El
  frontend solo necesita `withCredentials: true`.
- Todo endpoint que toca un caso filtra por `user_id`. Un caso ajeno da `404`.

---

## 8. Interfaz

Especificaciones por módulo en `ui/`, con `ui/DESIGN_SYSTEM.md` como base
obligatoria (tokens, paleta, tipografía).

| Módulo | Archivo | Código |
|---|---|---|
| Landing, login, registro, perfil | `ui/AUTH.md` | `pages/` |
| Lista y gestión de casos | `ui/CASES.md` | `features/cases/` |
| Visualizador 3D | `ui/VIEWER3D.md` | `features/viewer3d/` |
| Selección de landmarks | `ui/LANDMARKS.md` | `features/landmarks/` |
| Control y progreso del pipeline | `ui/PIPELINE.md` | `features/pipeline/` |
| Resultado y exportación | `ui/RESULT.md` | `features/cases/result` |

Estética: dashboard oscuro premium con visualización 3D central. Tres modos de
color por variables CSS: `dark` (por defecto), `light` y `purple`.

Hay además una página **FLAME Map**, herramienta interna de desarrollo para
inspeccionar y refinar la correspondencia entre los landmarks del protocolo y los
vértices de FLAME. No forma parte del flujo forense
(`concepts/parametros-warning-y-flame-map.md`).

---

## 9. Contenedores y despliegue

### Desarrollo

```bash
./scripts/setup.sh    # primera vez: build + migraciones
./scripts/start.sh    # levanta api + worker + postgres + redis + frontend
```

Frontend en `:5173`, API en `:8000`, Swagger en `:8000/docs`. No hace falta tener
Python ni Node instalados: todo corre en contenedores (`docker/LOCAL.md`,
`docker/SERVICES.md`).

### Producción

Dos artefactos posibles, documentados en `arquitecture/DEPLOY.md` y
`arquitecture/DEPLOY_FREE.md`:

1. **Por piezas separadas** — `api`, `worker` y el `dist/` del frontend, más
   Postgres, Redis y almacenamiento S3. Es la topología de producción.
2. **Contenedor único** (`Dockerfile` de la raíz) — las seis piezas en una
   imagen, con SQLite y Redis embebidos si no se configuran externos. Pensado
   para planes gratuitos y demos; cada pieza interna se sustituye por un
   servicio gestionado con una variable de entorno.

El modelo FLAME (`generic_model.pkl`, ~53 MB) nunca viaja en el repo ni en las
imágenes públicas: su licencia no permite redistribuirlo. Se provee por volumen
montado, horneado en la imagen desde `deploy/flame/`, o descargado en el arranque
con `FLAME_MODEL_URL`. Sin él, los pasos 1–8 corren y el 9 falla con un error
explícito.

---

## 10. Límites conocidos

El sistema es honesto sobre lo que no puede hacer, y conviene decirlo en voz alta:

- **Sin verdad de terreno.** No hay pares cráneo–cara escaneados para validar, así
  que hoy no se puede afirmar cuánto se equivoca en milímetros.
- **Espesores independientes.** La tabla FSTT da 21 valores sin modelo de la
  distribución conjunta, y los ajustes por sexo/edad/ancestría son constantes
  aditivas iguales para todos los puntos — anatómicamente una simplificación.
- **21 landmarks, y los laterales de un solo lado.** El lado izquierdo de la cara
  sale enteramente del prior de FLAME.
- **Sin textura ni identidad.** La salida es una máscara gris.
- **Umbrales calibrados a mano.** Funcionan, pero no están justificados con datos.
- **Sesgo conservador.** Un cráneo atípico produce residuales altos → pesos bajos
  → resultado más cerca del promedio de FLAME. El sistema es más conservador
  justamente en los casos raros, que son donde una reconstrucción sería más útil.
  Está mitigado porque se reporta como `degraded`, pero está.

---

## 11. Dónde seguir leyendo

| Pregunta | Archivo |
|---|---|
| ¿Por qué existe el problema y qué significa cada concepto? | `concepts/contexto-conceptual-del-problema-y-procedimiento.md` |
| ¿Cómo se colocan los landmarks y se elige el perfil? | `concepts/guia-landmarks-perfil-pipeline.md` |
| ¿Qué significa el warning de calidad, el factor k, FLAME Map? | `concepts/parametros-warning-y-flame-map.md` |
| ¿Qué hace exactamente el paso N? | `pipeline/step1.md` … `step9.md` |
| ¿Qué tecnología se usa y por qué? | `arquitecture/STACK.md` |
| ¿Cómo es el esquema de la base? | `arquitecture/DB.md` |
| ¿Cómo funciona la sesión y la propiedad de casos? | `arquitecture/AUTH.md` |
| ¿Cómo se despliega? | `arquitecture/DEPLOY.md` · `DEPLOY_FREE.md` |
| ¿Cómo debe verse la interfaz? | `ui/DESIGN_SYSTEM.md` y el resto de `ui/` |
| ¿Cómo son los contenedores? | `docker/LOCAL.md` · `SERVICES.md` · `PROD.md` · `ALLINONE.md` |
| ¿Cómo trabajar con agentes de IA en este repo? | `AGENTS.md` (raíz) |

### Referencias académicas

- Rhine & Campbell (1980) — protocolo de 21 landmarks FSTT
- Hona & Stephan (2024) — T-Table Global 2023, 220 000 mediciones
- Liang et al. (2024) — Skull-to-Face, IEEE TVCG
- Qiu et al. (2022) — SCULPTOR, ACM TOG
- Li et al. (2017) — FLAME
