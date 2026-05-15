# Guia Practica: Landmarks, Perfil y Pipeline

Documento orientado al operador que usa el sistema para producir una
aproximacion craneofacial consistente.

Complementa:
- `docs/pipeline/step3.md`
- `docs/pipeline/step4.md`
- `docs/pipeline/step5.md`
- `docs/ui/LANDMARKS.md`
- `docs/ui/PIPELINE.md`

## Objetivo

Esta guia responde tres preguntas operativas:

1. Como colocar mejor los 21 landmarks del protocolo usado por la app.
2. Como elegir los parametros del perfil biologico.
3. Como interpretar los controles del pipeline: `confidence` y `k`.

## Regla general de marcado

- Coloca cada landmark sobre la superficie osea real, no sobre una suposicion de piel.
- Prioriza la coherencia anatomica entre puntos antes que la precision visual aislada de un solo punto.
- Si dudas entre dos ubicaciones cercanas, elige la mas reproducible para otro operador.
- Evita marcar bordes rotos, dientes sueltos, ruido del escaneo o triángulos deformados.
- Usa zoom, giro y vistas laterales con calma; muchos errores vienen de marcar solo en vista frontal.
- Si una zona esta danada, marca la mejor estimacion anatomica y documenta esa incertidumbre en notas del caso.

## Los 21 landmarks y su ubicacion estimada

### Linea media

`supraglabella`
: Punto superior a la glabela, sobre la eminencia frontal media. Debe quedar en la linea media.

`glabella`
: Punto mas prominente entre los arcos superciliares, en la linea media frontal.

`nasion`
: Interseccion de frontal y huesos nasales, en la raiz de la nariz.

`end_of_nasal_bone`
: Extremo inferior del hueso nasal, antes de pasar al soporte cartilaginoso.

`mid_philtrum`
: Proyeccion osea media bajo la apertura nasal, orientada al filtrum.

`upper_lip_margin`
: Referencia media superior de la region alveolar/labial.

`lower_lip_margin`
: Referencia media inferior de la region alveolar/labial mandibular.

`chin_lip_fold`
: Zona media del surco mentolabial.

`mental_eminence`
: Punto mas prominente del menton oseo en la linea media.

`beneath_chin`
: Punto bajo el menton, en la transicion inferior mandibular media.

### Lado derecho

`right_supraorbital`
: Reborde orbitario superior derecho.

`right_suborbital`
: Reborde orbitario inferior derecho.

`right_lateral_orbit`
: Margen lateral de la orbita derecha.

`right_zygomatic_arch`
: Arco cigomatico derecho, en la zona lateral mas clara y reproducible.

`right_zygomatic`
: Eminencia del hueso cigomatico derecho.

`right_masseter_muscle`
: Cara lateral mandibular donde anatomica y funcionalmente se relaciona el masetero.

`right_gonion`
: Angulo mandibular derecho.

`right_supra_M2`
: Zona suprayacente al segundo molar superior derecho.

`right_occlusal_line`
: Referencia lateral de la linea oclusal derecha.

`right_inferior_malar`
: Region malar inferior derecha.

`temporal_fossa`
: Fosa temporal derecha.

## Consejos de colocacion por estabilidad

Mas estables y valiosos para la alineacion global:
- `glabella`
- `nasion`
- `supraglabella`
- `mental_eminence`
- `beneath_chin`
- `right_gonion`

Mas sensibles al error anatomico o a mapping FLAME:
- `right_masseter_muscle`
- `right_zygomatic`
- `right_zygomatic_arch`
- `right_lateral_orbit`
- `temporal_fossa`
- `right_supra_M2`
- `right_occlusal_line`

Eso no significa que estos ultimos no importen. Significa que si quedan mal
ubicados pueden empujar la reconstruccion hacia deformaciones menos confiables.

## Checklist rapido antes de guardar landmarks

- La linea media realmente cae en la linea media del craneo.
- `nasion`, `glabella` y `supraglabella` no quedaron desplazados lateralmente.
- `mental_eminence` y `beneath_chin` no quedaron sobre dientes o borde roto.
- Los puntos orbitarios estan sobre rebordes oseos, no dentro de cavidades por error de clic.
- `right_gonion` y `right_masseter_muscle` no estan intercambiados.
- La distribucion espacial de los 21 puntos "dibujaria" una cara plausible.

## Perfil biologico: como elegirlo

El perfil biologico no "adivina" la cara. Sirve para seleccionar profundidades
FSTT mas coherentes con el caso.

### `sex`

Valores:
- `M`
- `F`

Uso:
- Modifica las profundidades FSTT base en varios landmarks.
- No cambia identidad, expresion ni "estetica"; solo influye en el espesor de tejido blando.

Recomendacion:
- Elige el valor con mejor respaldo osteologico disponible.
- Si el caso es incierto, usa el valor mas defendible y baja la confianza del perfil.

### `ancestry`

Valores actuales:
- `global`
- `latinoamerican`
- `turkish`
- `korean`
- `caucasian`

Uso:
- Ajusta la tabla FSTT hacia medias mas cercanas a la poblacion estimada.

Recomendacion:
- No uses `ancestry` como afirmacion identitaria fuerte.
- Si la estimacion es debil, `global` es una opcion prudente.

### `age_range`

Valores:
- `18-35`
- `35-50`
- `50+`
- `unknown`

Uso:
- Ajusta las profundidades FSTT por rango etario.

Recomendacion:
- Si no hay una base razonable para el rango, usa `unknown` antes que forzar una edad.

### `confidence`

Rango:
- `0.0` a `1.0`

Interpretacion practica:
- `0.8 - 1.0`: perfil bastante respaldado.
- `0.5 - 0.7`: perfil util, pero con incertidumbre visible.
- `< 0.5`: mejor tratar el resultado como exploratorio.

Importante:
- `confidence` documenta tu seguridad sobre el perfil.
- No cambia sola la malla de forma drastica; hoy se usa como trazabilidad y lectura del caso.

## Parametros del pipeline

### `quality_status`

Valores comunes:
- `ok`
- `degraded`
- `fallback`

Lectura:
- `ok`: la reconstruccion mantuvo forma humana y el ajuste fue razonablemente consistente.
- `degraded`: hubo tensiones entre landmarks, FSTT y FLAME; el sistema limito la deformacion.
- `fallback`: el sistema tuvo que quedarse muy cerca de FLAME alineado para no producir una forma no anatomica.

### `confidence_score`

Es una medida interna de confianza geometrica del resultado final.

No significa:
- "verdad" de la cara
- probabilidad de identidad

Si significa:
- cuanto logro armonizar el sistema landmarks, FSTT y forma humana sin deformaciones problemáticas

Lectura orientativa:
- `>= 0.75`: aproximacion util para apoyo visual
- `0.55 - 0.74`: usable con cautela
- `< 0.55`: resultado exploratorio; revisar landmarks y perfil

### `k`

`k` es un ajuste exploratorio del grosor FSTT.

Uso practico:
- `0.0`: punto de partida recomendado
- `> 0`: empuja a una cara algo mas gruesa
- `< 0`: empuja a una cara algo mas delgada

Importante:
- En la implementacion actual `k` no representa una sigma real por landmark.
- No debe presentarse como desviacion estandar clinica o forense.
- Sirve para explorar sensibilidad del resultado mientras existan solo medias FSTT en la tabla activa.

## Flujo recomendado de trabajo

1. Carga la malla y verifica que la geometria sea usable.
2. Coloca los 21 landmarks sin prisa, revisando vistas frontal, lateral e inferior.
3. Guarda landmarks y revisa mentalmente si la nube de puntos "hace sentido".
4. Completa perfil biologico con la mejor evidencia disponible.
5. Ejecuta el pipeline primero con `k = 0.0`.
6. Si la confianza sale baja, revisa primero landmarks antes de tocar `k`.
7. Usa `k` solo para exploracion controlada, no para "forzar" una cara deseada.

## Cuando conviene repetir el marcado

Repite landmarks si:
- `quality_status` sale `degraded` o `fallback`
- el warning menciona landmarks laterales con residual alto
- la cara resultante se ve torcida, colapsada o desproporcionada
- el menton, la raiz nasal o el lateral orbitario se ven claramente fuera de lugar

Los tres puntos que mas conviene re-chequear primero suelen ser:
- `nasion`
- `right_lateral_orbit`
- `right_masseter_muscle`

## Que no debe concluirse del resultado

- No identifica a una persona.
- No reemplaza juicio forense, antropologico o medico.
- No garantiza exactitud en nariz, labios, pabellon auricular o tejido blando fino.
- No convierte un perfil incierto en una conclusion fuerte.

## Resumen operativo

Si quieres la mejor aproximacion posible hoy:
- marca bien la linea media
- cuida mucho orbita lateral, cigomatico y gonion
- usa un perfil biologico defendible
- corre primero con `k = 0.0`
- interpreta `confidence_score` como calidad geometrica, no como verdad facial
