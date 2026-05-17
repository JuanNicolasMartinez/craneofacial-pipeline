# Parametros, Warning De Calidad y FLAME Map

Documento orientado a operador.

1. que significa `Confianza del operador`
2. que significa `Ajuste exploratorio FSTT (k)`
3. que quiere decir el warning `Calidad: degraded`
4. que es la pagina `FLAME Map` y como leer sus controles

Complementa:
- `docs/pipeline/step4.md`
- `docs/pipeline/step5.md`
- `docs/pipeline/step9.md`
- `docs/ui/PIPELINE.md`
- `docs/ui/RESULT.md`
- `docs/concepts/guia-landmarks-perfil-pipeline.md`

## 1. Confianza del operador

### Que es

`Confianza del operador` es la seguridad humana con la que se escogio el
perfil biologico:

- sexo estimado
- ancestria estimada
- rango etario estimado

No describe la calidad de la malla ni la calidad matematica de la
reconstruccion. Describe cuan defendible te parece ese perfil antes de correr
el pipeline.

### Para que sirve hoy

En el codigo actual, este valor:

- se guarda en `biological_profiles.confidence`
- queda en trazabilidad del caso
- ayuda a interpretar despues que tan exploratorio fue el perfil elegido

En el estado actual del proyecto, **no esta conectado de forma directa al
solver geometrico**. Es decir:

- no cambia por si solo la tabla FSTT
- no cambia por si solo la forma de la cara
- no activa por si solo `ok`, `degraded` o `fallback`

La seleccion de tabla FSTT depende hoy sobre todo de `ancestry`:

- `latinoamerican` -> `Moritsugui-2022`
- cualquier otro valor actual -> `T-Table-Global-2023`

### Como usarlo

Lectura practica:

- `0.80 - 1.00`: el perfil esta bien respaldado por el caso
- `0.50 - 0.75`: el perfil es util, pero hay duda visible
- `< 0.50`: conviene leer la reconstruccion como exploratoria

### Que no debes confundir

`Confianza del operador` no es lo mismo que `confidence_score`.

- `Confianza del operador`: juicio humano sobre el perfil biologico
- `confidence_score`: medida interna del backend sobre estabilidad geometrica

## 2. Ajuste exploratorio FSTT (k)

### Que es

`k` es un ajuste manual pequeno que desplaza todas las profundidades FSTT hacia
arriba o hacia abajo para explorar sensibilidad del resultado.

No es un control artistico para "moldear" la cara a gusto. Tampoco es una
desviacion estandar clinica real.

### Como se usa realmente en el backend

En la implementacion actual, para cada landmark el backend toma la profundidad
FSTT base y le suma:

```text
depth_final_mm = max(depth_base_mm + k * 2.0, 1.0)
```

Eso significa:

- `k = 0.0` -> usa la profundidad media de la tabla
- `k = +0.5` -> suma aproximadamente `+1.0 mm` a todos los landmarks
- `k = +1.0` -> suma aproximadamente `+2.0 mm`
- `k = +1.5` -> suma aproximadamente `+3.0 mm`
- `k = -0.5` -> resta aproximadamente `-1.0 mm`
- `k = -1.0` -> resta aproximadamente `-2.0 mm`
- `k = -1.5` -> resta aproximadamente `-3.0 mm`

Ademas, el sistema nunca deja una profundidad por debajo de `1.0 mm`.

### Que efecto tiene

Lectura intuitiva:

- `k > 0` -> cara algo mas "gruesa" o con mas tejido
- `k < 0` -> cara algo mas "delgada" o con menos tejido
- `k = 0` -> punto de partida recomendado

Importante: el ajuste es **global**, no por region.

Eso quiere decir que `k`:

- no engrosa solo mejillas
- no afina solo nariz
- no corrige un landmark mal marcado

### Por que se llama "exploratorio"

Porque la tabla FSTT actual contiene medias, pero no desviaciones estandar por
celda suficientemente modeladas como para hablar de variantes `thin/mean/thick`
con peso estadistico fuerte.

Por eso, hoy `k` sirve para:

- explorar sensibilidad
- comparar una corrida base contra una variacion pequena

Y no deberia usarse para:

- "forzar" un rostro deseado
- compensar landmarks dudosos
- vender una precision estadistica que la tabla actual no trae

### Recomendacion de uso

Orden recomendado:

1. correr primero con `k = 0.0`
2. si el resultado sale raro, revisar landmarks y perfil antes de tocar `k`
3. si quieres explorar sensibilidad, probar `k = +0.5` o `k = -0.5`
4. evitar cambios grandes salvo que haya una razon metodologica para hacerlo

## 3. Warning: Calidad `degraded`

### Que significa

`degraded` significa:

- el pipeline **si termino**
- el backend **si pudo exportar una cara**
- pero la deformacion completa no fue lo bastante estable como para marcarla
  como `ok`

En otras palabras, el sistema prefirio publicar una cara humana conservadora
antes que empujar el ajuste hasta una deformacion poco plausible.

No significa automaticamente:

- que el pipeline fallo
- que la cara este "mal" en absoluto
- que haya error de software

Si significa:

- que hubo tension entre landmarks, FSTT y prior humano FLAME
- que el sistema redujo agresividad en la deformacion
- que el resultado debe leerse con mas cautela

### Como decide el backend entre `ok`, `degraded` y `fallback`

Regla actual:

- `fallback` si el blend final queda en `alpha = 0.0`
- `ok` si `confidence_score >= 0.72` y `alpha >= 0.65`
- en cualquier otro caso exportable -> `degraded`

Lectura practica:

- `ok`: ajuste suficientemente consistente
- `degraded`: hubo que limitar parte del ajuste
- `fallback`: el sistema se quedo muy cerca de FLAME alineado para no romper la forma

### Que mira el backend para emitir la advertencia

Entre otras cosas, el backend revisa:

- residual rigido medio alto
- residual rigido maximo alto
- pocos landmarks rigidos confiables
- bbox deformada fuera de rango respecto a los puntos FSTT
- error alto entre landmarks/objetivos FSTT y la deformacion final
- landmarks con peso bajo por baja confianza local
- deformacion residual demasiado agresiva

### Como leer el warning de tu ejemplo

Texto resumido del ejemplo:

- `Aproximacion de confianza 0.72`
- `residual rigido medio alto (5.82mm)`
- `residual rigido maximo alto (8.51mm)`
- `bbox FSTT x bajo (0.45)`
- `bbox FSTT y bajo (0.53)`
- landmarks mas inciertos:
  - `temporal_fossa = 8.51mm`
  - `right_lateral_orbit = 8.05mm`
  - `nasion = 7.25mm`

Interpretacion:

- la alineacion global no quedo tan limpia como se esperaba
- la cara deformada quedo mas comprimida que la nube FSTT en algunos ejes
- algunos landmarks clave quedaron tensando el ajuste
- por eso el sistema limito la deformacion para mantener una cara humana razonable

### Que hacer cuando sale `degraded`

Orden recomendado:

1. revisar primero landmarks con peor residual
2. verificar linea media, nasion, lateral orbitario y regiones laterales
3. confirmar que el perfil biologico elegido sea defendible
4. reintentar con `k = 0.0` antes de explorar valores mas altos o mas bajos
5. usar variaciones pequenas de `k` solo despues de revisar el marcado

## 4. Que es la pagina `FLAME Map`

### Que es realmente

`FLAME Map` no es una pagina de operacion normal del caso.

Es una **herramienta local de calibracion en desarrollo** para mapear los 21
labels anatomicos del protocolo hacia indices de vertices de la plantilla
FLAME.

Su salida no modifica automaticamente la reconstruccion en ese momento. Sirve
para inspeccionar y exportar un mapping que luego se puede llevar a:

- `backend/app/core/flame_landmarks.py`

La pagina se habilita solo en desarrollo (`import.meta.env.DEV`).

### Para que existe

La reconstruccion necesita saber que vertice del template FLAME corresponde a
cada label anatomico, por ejemplo:

- `glabella`
- `nasion`
- `right_gonion`
- `temporal_fossa`

Ese mapping canonico es el que luego usa el backend para:

- la alineacion robusta tipo Procrustes
- el ajuste contra los 21 puntos de control
- la deformacion final

### Por que puedes ver el espacio 3D pero no el objeto

Con el codigo actual hay una razon muy probable:

- la vista monta el canvas y la grilla siempre
- pero **no hace `fitBounds()` automatico** sobre la plantilla FLAME al abrir

Ademas, la propia funcion de carga documenta que FLAME viene en unidades nativas
aproximadas de metros, mientras que los presets de camara del viewer estan
pensados para craneos del flujo principal.

Resultado posible:

- la escena abre
- la grilla se ve
- pero la plantilla FLAME queda muy pequena, lejos o mal encuadrada

Eso no necesariamente significa que la malla no exista.

Hay un segundo problema posible:

- la vista si consulta `/dev/flame/mapping`
- pero no tiene un mensaje de error especifico para la carga visual de
  `/dev/flame/template.ply`

Entonces puede ocurrir un canvas aparentemente vacio si el mapping cargo, pero
la malla de template no se renderizo como esperabas.

### Que hace el panel derecho

#### Barra superior `X / 21 labels asignados`

Muestra cuantos labels del protocolo ya tienen un vertice FLAME asociado en el
mapping borrador.

#### Tarjeta `Label N / 21`

Muestra el label activo que estas editando.

Incluye:

- nombre del label actual
- descripcion anatomica corta
- `Vertex actual`: indice de vertice que hoy tiene ese label en el mapping
- `Pick actual`: indice del ultimo vertice que seleccionaste con clic sobre la malla

#### Badge `Rigid subset`

Marca labels que pertenecen al subconjunto robusto usado en la alineacion
global Procrustes.

Son especialmente sensibles porque un error ahi puede afectar mas la colocacion
global de la cara en el espacio.

#### Botones `Anterior` y `Siguiente`

Sirven para moverte entre los 21 labels sin cambiar nada todavia.

#### Boton `Asignar <label>`

Toma el `Pick actual` y lo guarda como el vertice asociado al label actual
dentro del mapping borrador.

No escribe el archivo Python automaticamente. Solo actualiza el estado local de
la herramienta.

#### Boton `Limpiar label actual`

Quita la asignacion del label actual en el borrador.

#### Botones `Copiar JSON` y `Descargar`

Exportan el mapping borrador en JSON para:

- revisarlo
- compartirlo
- usarlo luego para actualizar el mapping canonico del backend

#### Seccion `Mapping actual`

Lista los 21 labels y muestra:

- si tienen vertice asignado
- que indice de vertice usan
- cual fila estas editando ahora

## 5. Que hacen los controles flotantes del visor en `FLAME Map`

Abajo a la derecha del canvas aparecen controles heredados del viewer general.

### Grupo de vistas

Los iconos cambian la camara a presets:

- frontal
- perfil derecho
- perfil izquierdo
- superior
- inferior
- isometrica

Atajos de teclado:

- `1` -> frontal
- `3` -> perfil derecho
- `7` -> superior

### Slider con circulo

Es el control global de tamano de landmarks del viewer compartido.

En `FLAME Map` puede tener poca utilidad visual porque esta vista no muestra la
misma capa de landmarks del flujo clinico; aqui lo principal es el vertice
seleccionado y el mapping.

### Grupo inferior

- lupa `+` -> acercar
- lupa `-` -> alejar
- flecha circular -> reset de camara
- `#` -> mostrar/ocultar grilla

Atajos:

- `R` o `F` -> reset de camara
- `G` -> toggle de grilla
- `+` y `-` -> zoom

## 6. Resumen corto

- `Confianza del operador` documenta tu seguridad sobre el perfil; hoy no mueve
  directamente la geometria.
- `k` desplaza todas las profundidades FSTT de forma global; `k = 0` es la
  referencia.
- `degraded` significa "resultado exportado con deformacion limitada", no
  "pipeline roto".
- `FLAME Map` es una herramienta de calibracion de desarrollo para revisar el
  mapping entre labels y vertices FLAME, no una vista normal del caso.
