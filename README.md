# Calculadora de rutas — vista

Frontend del [generador de rutas por experiencia de manejo](../generador-rutas_2)
(NestJS sobre un grafo de OpenStreetMap). Busca rutas en auto que priorizan las
curvas y el tipo de superficie, no el tiempo. Recrea el handoff de diseño
*Meridiano* en su tema **Crepúsculo**: tinta dorada sobre papel nocturno violeta,
serif con cursivas, monoespaciada para los datos y grano de película sobre toda la
interfaz.

React 19 + TypeScript + Vite + Leaflet. Idioma de interfaz: español. Probado en
Chrome y Firefox recientes.

## Puesta en marcha

```bash
npm install
cp .env.example .env    # VITE_API_URL apunta al backend (default http://localhost:3000)
npm run dev
```

El backend debe estar corriendo (`npm run start:dev` en `generador-rutas_2`), con
MongoDB disponible y **las calles ya cargadas**. La vista no importa zonas: eso se
hace en el backend (`POST /import` o su CLI). Si un punto cae fuera de la zona
cargada, la vista lo avisa al trazar.

## Cómo se conecta con el backend

| UI | Backend |
|---|---|
| Botón *Trazar la ruta* / *Buscar circuito* / *Recalcular* | `POST /routes/calculate` |

El cálculo nunca se dispara solo: siempre lo pide el usuario, y los puntos y
parámetros se conservan entre cálculos. Si cambian después de calcular, la ruta
anterior sigue a la vista con un aviso de que está desactualizada.

### Modalidades

| Modalidad (sección 01) | Cuerpo de la petición |
|---|---|
| *Directa* (A → B) | `origin`, `destination` y, si se movió el control, `maxDetourRatio` |
| *Circuito* (vuelve al inicio) | `origin` y `targetLengthKm`, **sin** `destination` |
| *Con largo* (A → B · km) | `origin`, `destination` y `targetLengthKm` |

- El largo va de 2 a 300 km y el backend acepta una banda fija de ±15 %.
- Si no hay un circuito desde la partida, el backend entrega una **ida y vuelta**
  hasta un punto de giro. La vista lo explica, distingue si está demostrado que no
  existe un circuito o si la búsqueda no lo encontró (`circuitImpossible`) y marca
  el punto de giro en el mapa.
- En la ruta directa, el *desvío máximo* limita cuánto más larga que la más corta
  puede ser la ruta: de ninguno a +200 % (`maxDetourRatio` de 1 a 3). Si no se toca,
  se usa el del perfil.

### Perfiles y pesos

Los tres perfiles base son los mismos del backend
([profiles.ts](../generador-rutas_2/src/routes/profiles.ts)), replicados en
[`PROFILE_WEIGHTS`](src/lib/planner.ts), junto con su desvío por defecto.

| Perfil | `curvinessWeight` | `surfaceWeight` | Desvío por defecto |
|---|---|---|---|
| Curvas (`moto-curvas`) | 3 | 0 | +50 % (×1,5) |
| 4×4 (`4x4`) | 0 | −6 | +100 % (×2,0) |
| Escénico (`scenic`) | 4 | 2 | +50 % (×1,5) |

- Con un perfil activo la petición va como `profile: "moto-curvas"` (etc.) y el
  backend resuelve los pesos.
- Mover *Curvas* o *Tipo de camino* **desactiva el perfil** y la petición pasa a
  `profile: "custom"` con los dos pesos explícitos (desvío por defecto +50 %).

| Control | Campo de la API |
|---|---|
| Curvas (slider) | `curvinessWeight` 0..6: cuánto se evitan las rectas |
| Tipo de camino (slider) | `surfaceWeight` −6..6: > 0 evita lo sin pavimentar, < 0 evita el pavimento |
| Desvío máximo (slider, solo en la directa) | `maxDetourRatio` 1..3 |
| Largo (campo, en circuito y con largo) | `targetLengthKm` 2..300 |

### Servicios externos

Lo que el backend no expone se pide desde el navegador, aislado en
[src/api/](src/api/):

- **Nominatim** (OSM): el backend rutea por `{lat, lon}` y no tiene geocodificador.
  Los campos de partida y destino y el buscador (Ctrl K / ⌘K) resuelven nombres de
  lugar a coordenadas. También aceptan `lat, lon` escrito a mano, el clic en el mapa
  o arrastrar los marcadores. Las coordenadas de cada punto se ven al pasar el cursor
  sobre su campo.
- **Teselas**: OSM, OpenTopoMap y Esri World Imagery para el selector de capas.

La vista no usa datos de elevación: la pendiente está fuera del alcance del proyecto
y el backend no la maneja.

## Bitácora

Toda la información de la ruta vive en un único panel anclado abajo, ordenado por
importancia:

1. **Avisos**: ruta desactualizada, ida y vuelta en lugar de circuito, largo fuera
   del margen, tramo de acceso del circuito que se recorre de ida y de vuelta (en
   dorado en el mapa) y puntos a más de 200 m de la vía más cercana.
2. **Cifras**: distancia, porcentaje del recorrido en tramos con curvas,
   porcentaje sin pavimentar y, según la modalidad, el desvío frente a la ruta más
   corta o el largo logrado frente al pedido.
3. **Repartos** (*Ver detalle*): tipo de vía y superficie por distancia, y qué parte
   de la superficie dedujo el backend porque OpenStreetMap no la indica.

*GPX* descarga la ruta con un waypoint de partida y otro de llegada (uno solo en el
circuito) y, en la ida y vuelta, el punto de giro.

## Qué es real y de dónde sale

Todo lo que muestra la bitácora viene de `POST /routes/calculate`. En el cliente
sólo se calculan proporciones a partir de esos datos: los porcentajes de los
repartos, el sin pavimentar (ripio, tierra y arena), la superficie inferida
(`vecindad` + `tipo` en `surfaceSourceBreakdown`) y el tramo de acceso en el mapa (a
partir de `accessRepeatedMeters`). No se muestran estimaciones de tiempo, velocidad,
consumo ni desnivel: el backend no las calcula.

## Estados y errores

- La ruta directa responde en decenas de milisegundos: no hay pantalla de carga
  salvo que tarde más de 300 ms.
- El circuito y la ruta con largo tardan hasta ~7 s (más si el backend tiene otras
  búsquedas en cola). Se muestra un contador, un texto que cambia con el tiempo y un
  botón para cancelar. El cliente deja de esperar a los 45 s.
- El formulario valida el largo y los puntos antes de enviar, así que los errores
  de validación del backend (en inglés) no llegan al usuario. El resto de los
  mensajes se adapta en [src/lib/messages.ts](src/lib/messages.ts).

## Estructura

```
src/
  api/         client (backend), geocode (Nominatim)
  lib/         types, planner (perfiles, petición, repartos), messages, gpx, theme
  components/  Sidebar, MapView, ResultsPanel (bitácora), overlays, WaypointField,
               primitives, icons, styles
  App.tsx      estado y cálculo (con cancelación y plazo)
```

## Tema y tipografía

Un único tema, definido con 13 tokens CSS en [src/index.css](src/index.css) más el
filtro de las teselas y la capa de grano (`.grain-overlay`). Todo color de la app
sale de esas variables: cambiar el tema es cambiar el bloque `:root`.

La paleta usa **dos familias de tono y sólo dos**, y conviene mantenerlo:

- **fría (251-256°)**: papel, reglas y `--accent`. Suelo y acento son parientes,
  así que la interfaz no compite consigo misma.
- **cálida (23-40°)**: `--amber`, `--amber-deep` y `--terra`, que no son tres
  acentos rivales sino tres intensidades del mismo oro. Es el único contraste
  deliberado de la app.

Dos reglas que salieron de haberlo hecho mal antes:

1. **Saturación pareja entre acentos** (hoy 52-56%). Cuando uno se dispara —el ámbar
   llegó a estar en 78% frente al 53% del acento— se convierte en lo más ruidoso de
   la pantalla y la jerarquía cromática queda invertida.
2. **El acento no puede caer cerca del azul del mapa** (~200° tras el
   `hue-rotate` de las teselas), o la ruta se funde con el fondo.

En el mapa se solapan el trazo, su discontinua animada, el acceso del circuito en
dorado, el punto de giro y los pines de partida y destino, así que la separación se
apoya tanto en el valor como en el tono.

La tipografía vive en [src/components/styles.ts](src/components/styles.ts). Ningún
componente declara fuente, tamaño o peso a mano — todo sale de `text.*`, sobre una
escala de siete pasos (`10 · 11 · 13 · 15 · 19 · 24 · 34`):

| Rol | Familia | Uso |
|---|---|---|
| `displayXl` / `display` | serif 600 | título de la app / títulos de sección y overlay |
| `title` | serif 500 *itálica* | nombre del trayecto en la bitácora |
| `figureXl` | serif 500 | cifras de la bitácora |
| `body` / `bodyStrong` / `bodySm` | Inter | prosa, campos, avisos y botones |
| `eyebrow` | Inter 500 versalitas | **todas** las etiquetas |
| `caption` | Inter 400 | etiquetas apagadas (pies de dato, barras) |
| `data` | mono | km, %, coordenadas |
| `aside` | serif *itálica* | voz del cartógrafo: notas y pistas |

**La cursiva sólo aparece en `aside` y `title`**: nunca en botones, subtítulos ni
mensajes de error.
