# Contexto Conceptual Del Problema y Del Procedimiento

Este documento explica el problema que resuelve el sistema, los conceptos clave
que usa y el sentido de cada etapa del procedimiento.

Complementa:
- `docs/arquitecture/STACK.md`
- `docs/pipeline/README.md`
- `docs/pipeline/step5.md`
- `docs/pipeline/step7.md`
- `docs/pipeline/step8.md`
- `docs/pipeline/step9.md`

## El problema

La reconstruccion craneofacial intenta producir una aproximacion visual del
rostro a partir de un craneo, landmarks anatomicos y datos de grosor de tejido
blando.

El problema es dificil por una razon central:

- el craneo no contiene una "cara completa" codificada de forma determinista

Muchas partes del rostro se relacionan con el hueso, pero no de manera exacta:
- grosor de mejilla
- forma fina de labios
- cartilago nasal
- tejido periorbitario
- contorno blando mandibular

Por eso el sistema no debe vender certeza falsa. Debe producir una
aproximacion humana, trazable y metodologicamente honesta.

## Que hace este sistema

El sistema combina tres fuentes de informacion:

1. `Landmarks` manuales sobre el craneo
2. `FSTT` segun perfil biologico
3. `FLAME` como prior de forma facial humana

La idea no es que una sola fuente mande sobre las otras. La idea es equilibrar:

- landmarks para anclar anatomia
- FSTT para estimar profundidad de tejido
- FLAME para conservar una cara humana plausible

## Conceptos clave

### Craneo

Es la geometria osea cargada como malla 3D (`.ply`, `.obj`, `.stl`).

En este sistema:
- se preprocesa para limpiar degeneraciones simples
- se mantiene el sistema de coordenadas
- se recalculan normales desde la malla real

### Landmark

Un landmark es un punto anatomico definido sobre el craneo.

En este proyecto:
- son 21 landmarks del protocolo Rhine & Campbell
- se colocan manualmente
- se guardan como coordenadas 3D y normal capturada en el clic

Rol conceptual:
- traducen la observacion forense en restricciones geometricas utilizables

### Normal de superficie

Es el vector perpendicular a la superficie osea local.

Rol:
- permite proyectar un punto craneal hacia afuera para construir una hipotesis
  de punto facial

Importante:
- la reconstruccion no confia en la normal enviada por el frontend
- el backend recalcula la normal desde el vertice mas cercano del craneo real

### FSTT

`FSTT` significa `Facial Soft Tissue Thickness`, o grosor de tejido blando
facial.

Es el espesor estimado entre el hueso y la superficie de piel en landmarks
anatomicos especificos.

No es:
- una verdad exacta por individuo
- una receta completa del rostro

Si es:
- una guia estadistica anatomica util

En este sistema:
- se obtiene desde una tabla estatica citada
- depende de `sex`, `ancestry` y `age_range`
- se usa para construir puntos de control faciales

### Perfil biologico

Es la estimacion operativa del caso:
- sexo
- region poblacional
- rango de edad
- confianza del operador

Rol:
- seleccionar medias FSTT mas coherentes con el caso

Limite:
- no convierte la reconstruccion en identificacion

### Punto de control facial

Es el punto que se obtiene al partir del landmark craneal y desplazarlo hacia
afuera por la normal local una distancia FSTT.

Conceptualmente:

`p_facial = p_craneal + profundidad_FSTT * normal`

Rol:
- sirve como objetivo anatomico para guiar el ajuste de la cara

### FLAME

FLAME es un modelo facial paramétrico 3D de topologia consistente.

En este proyecto no se usa para "inferir identidad". Se usa como:
- prior anatomico de rostro humano
- geometria base estable
- soporte para deformar sin perder estructura facial general

Esa decision es clave. Sin un prior humano, perseguir landmarks/FSTT
directamente puede producir laminas dobladas o caras no plausibles.

### Procrustes

Es una alineacion por similitud:
- traslacion
- rotacion
- escala uniforme

Rol:
- llevar la FLAME base al sistema de referencia del craneo

Se hace usando un subconjunto de landmarks mas estables para que algunos puntos
mal marcados no tumben toda la alineacion global.

### TPS

`TPS` significa `Thin Plate Splines`.

Es una deformacion suave que permite ajustar la malla facial hacia los puntos de
control.

En un enfoque ingenuo, TPS puede sobredeformar la cara.

En este sistema, TPS se usa:
- con regularizacion
- con pesos robustos
- con anchors posteriores
- con limitacion de desplazamiento

Eso lo convierte en una correccion local, no en una licencia para destruir la
forma humana.

### Anchors de estabilizacion

Son puntos adicionales sobre zonas alejadas de landmarks faciales que se fijan
como identidad.

Rol:
- evitar que nuca, lateral o regiones poco controladas colapsen o se plieguen

### Prior humano

Es la idea de que la reconstruccion debe seguir pareciendo un rostro humano aun
cuando haya ruido, incertidumbre o landmarks problematicos.

En la practica, ese prior viene de:
- FLAME
- regularizacion del ajuste
- pesos robustos
- smoothing final conservador

### `quality_status`

Resume el estado del resultado exportado:
- `ok`
- `degraded`
- `fallback`

No habla de identidad. Habla de estabilidad y consistencia geometrica.

### `confidence_score`

Es una medida interna de cuan bien armonizaron:
- landmarks
- FSTT
- FLAME
- deformacion residual

Sirve para leer el nivel de confianza geometrica de la aproximacion final.

## La idea metodologica central

El sistema actual sigue una postura prudente:

- ni el hueso por si solo basta
- ni FSTT por si solo basta
- ni FLAME por si solo basta

La reconstruccion emerge del equilibrio entre evidencia anatomica e
incertidumbre.

Por eso el problema no se modela como:

- "hacer que todos los puntos coincidan exactamente"

Se modela mejor como:

- "buscar la mejor cara humana compatible con landmarks, FSTT y estabilidad"

## Procedimiento conceptual paso a paso

### 1. Ingesta del craneo

Se carga la malla 3D base del caso.

Objetivo conceptual:
- disponer del soporte oseo real sobre el cual se anclara el procedimiento

### 2. Preprocesamiento geometrico

Se limpia la malla sin cambiar su sistema de coordenadas.

Objetivo conceptual:
- reducir ruido geometrico que pueda arruinar clics, normales o exportacion

### 3. Seleccion de landmarks

El operador traduce conocimiento anatomico en puntos discretos sobre el craneo.

Objetivo conceptual:
- convertir observacion experta en datos geometricos

### 4. Perfil biologico

Se elige el perfil que alimenta la seleccion FSTT.

Objetivo conceptual:
- contextualizar el espesor de tejido blando

### 5. Construccion de puntos FSTT

Cada landmark craneal se proyecta hacia una hipotesis facial usando la normal
recalculada y la profundidad FSTT correspondiente.

Objetivo conceptual:
- pasar del hueso a una primera nube de puntos de tejido blando estimado

### 6. FLAME base

Se carga una cara neutra humana con topologia estable.

Objetivo conceptual:
- disponer de una geometria facial plausible antes de deformar

### 7. Alineacion rigidamente estable

La FLAME se alinea al sistema del craneo usando un subconjunto robusto de
landmarks.

Objetivo conceptual:
- ubicar correctamente la cara en el espacio del caso

### 8. Ajuste de forma + deformacion residual

Primero se ajusta FLAME de forma conservadora dentro de su espacio de forma.
Luego se aplica una correccion TPS limitada.

Objetivo conceptual:
- acercar la cara a la evidencia sin romper su plausibilidad

### 9. Exportacion con trazabilidad

Se exporta una sola cara principal junto con diagnosticos.

Objetivo conceptual:
- producir una salida util y auditable, no una imagen opaca o imposible de justificar

## Por que a veces el resultado sale `degraded` o `fallback`

Porque el sistema prefiere:
- una cara humana de menor confianza

antes que:
- una deformacion extrema
- una malla plegada
- una cara anatómicamente absurda

Esto ocurre tipicamente cuando:
- algunos landmarks laterales estan mal colocados
- el perfil biologico no encaja bien con el caso
- el mapping de landmarks hacia FLAME tensiona demasiado la deformacion

## Que significa "usar la literatura de la mejor manera"

En este contexto, significa:

- usar FSTT como estadistica, no como dogma
- aceptar incertidumbre anatomica real
- mantener trazabilidad del perfil y del proceso
- no inventar precision donde la tabla no la ofrece
- preservar un prior humano creible

No significa:
- prometer exactitud individual
- derivar identidad
- afirmar que la cara resultante es "la verdadera"

## Limites del sistema

El sistema no resuelve por completo:
- cartilago nasal fino
- grosor real de labios por individuo
- pabellon auricular verdadero
- asimetrias blandas no explicables por hueso
- rasgos puramente personales

Tampoco sustituye:
- antropologia forense
- juicio medico
- comparacion identificatoria formal

## Como debe leerse el resultado

La mejor lectura del resultado es:

- una hipotesis visual anatómicamente guiada
- una herramienta de apoyo
- una salida trazable y revisable

La peor lectura seria:

- una identificacion
- una prediccion exacta del rostro real
- una conclusion final por si sola

## Resumen conceptual

Landmarks aportan anclaje anatomico.

FSTT aporta profundidad estadistica de tejido.

FLAME aporta forma humana estable.

Procrustes ubica la cara en el espacio correcto.

TPS corrige localmente.

La confianza final depende de cuan bien conviven esas piezas sin destruir la
plausibilidad anatomica.
