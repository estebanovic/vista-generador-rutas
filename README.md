# Calculadora de rutas — vista

Frontend del [generador de rutas por experiencia de manejo](../generador-rutas_2)
(NestJS + Dijkstra ponderado sobre un grafo de OpenStreetMap). Recrea el handoff
de diseño *Meridiano* en su tema **Crepúsculo**: tinta dorada sobre papel nocturno
violeta, serif con cursivas, monoespaciada para los datos y grano de película sobre
toda la interfaz.

React 19 + TypeScript + Vite + Leaflet. Idioma de interfaz: español.

## Puesta en marcha

```bash
npm install
cp .env.example .env    # VITE_API_URL apunta al backend (default http://localhost:3000)
npm run dev
```

El backend debe estar corriendo (`npm run start:dev` en `generador-rutas_2`) y con
MongoDB disponible. **Antes de trazar hay que importar una zona**: encuadra un área
pequeña en el mapa y pulsa *Importar área visible* (sección 06 · Cartografía) — el
trazador sólo conoce las calles descargadas.

## Cómo se conecta con el backend

| UI | Backend |
|---|---|
| Botón *Importar área visible* | `POST /import` con el bbox visible del mapa |
| Botón *Trazar la ruta* | `POST /routes/calculate` (perfil base o `custom`) |

### Perfiles y pesos

Los tres perfiles base son los mismos del backend
([profiles.ts](../generador-rutas_2/src/routes/profiles.ts)), replicados en
[`PROFILE_WEIGHTS`](src/lib/planner.ts): `moto-curvas`, `4x4` y `scenic`.

- Con un perfil activo la petición va como `profile: "moto-curvas"` (etc.) y el
  backend resuelve los pesos.
- Tocar cualquier control específico **desactiva el perfil** y la petición pasa a
  `profile: "custom"` con los cuatro pesos explícitos.

| Control | Campo de la API |
|---|---|
| Curvas (slider) | `curvinessWeight` 0..1 |
| Tipo de camino (Pavimento / Mixto / Rural) | `surfaceWeight` `+1` / `0` / `-0.7` |
| Desnivel (Montañoso / Indiferente / Plano) | `elevationWeight` `-0.7` / `0` / `+1` |
| Recorrido (Directo / Medio / Largo) | `tripLength` — no desactiva el perfil |

`distanceWeight` no tiene control propio: lo fija el perfil, igual que en el backend.
El perfil también determina la velocidad base con la que se estiman tiempo, consumo
y CO₂.

Sólo hay trayectos A→B: el backend no rutea bucles ni idas y vueltas, así que la
vista no ofrece esas opciones.

### Servicios externos

Dos cosas que el backend no expone hoy y que por eso se piden desde el navegador.
Ambas están aisladas en [src/api/](src/api/) para poder moverlas al backend sin
tocar la UI:

- **Nominatim** (OSM) — el backend rutea por `{lat, lon}` y no tiene geocodificador.
  Los campos de origen/destino y el buscador ⌘K resuelven nombres de lugar a
  coordenadas. También acepta `lat, lon` escrito a mano, o clic en el mapa.
- **Open-Meteo elevation** — `RouteResult` trae el desnivel acumulado pero no la cota
  punto a punto, aunque el backend sí la tiene en Mongo (`nodes.elevation`). Mientras
  no la devuelva, el perfil se muestrea aparte (≤100 puntos, un request). Si falla,
  el panel lo dice y el resto sigue funcionando.
- **Teselas** — OSM, OpenTopoMap y Esri World Imagery para el selector de capas.

## Bitácora

Toda la información del viaje vive en un único panel anclado abajo. Plegado muestra
las cifras principales y el perfil altimétrico interactivo (el hover se sincroniza
con un marcador en el mapa); *Ver detalle* despliega tramos, altos, composición de
la vía y superficie, y la logística estimada.

## Qué es real y qué es estimado

Del trazador: distancia, desnivel acumulado, sinuosidad media y el reparto por tipo
de vía y superficie. Estimado en el cliente: duración, velocidad media, combustible,
CO₂ y paradas. Los *altos del trayecto* son los máximos locales más prominentes del
perfil de cotas.

## Estructura

```
src/
  api/         client (backend), geocode (Nominatim), elevation (Open-Meteo)
  lib/         types, planner (perfiles ↔ pesos + derivadas), theme, gpx
  components/  Sidebar, MapView, ResultsPanel (bitácora), overlays, primitives, icons
  App.tsx      máquina de estados idle → computing → ready
```

## Tema y tipografía

Un único tema, definido con 13 tokens CSS en [src/index.css](src/index.css) más el
filtro de las teselas y la capa de grano (`.grain-overlay`). Todo color de la app
sale de esas variables: cambiar el tema es cambiar el bloque `:root`.

La paleta usa **dos familias de tono y sólo dos**, y conviene mantenerlo:

- **fría (251-256°)** — papel, reglas y `--accent`. Suelo y acento son parientes,
  así que la interfaz no compite consigo misma.
- **cálida (23-40°)** — `--amber`, `--amber-deep` y `--terra`, que no son tres
  acentos rivales sino tres intensidades del mismo oro. Es el único contraste
  deliberado de la app.

Dos reglas que salieron de haberlo hecho mal antes:

1. **Saturación pareja entre acentos** (hoy 52-56%). Cuando uno se dispara —el ámbar
   llegó a estar en 78% frente al 53% del acento— se convierte en lo más ruidoso de
   la pantalla y la jerarquía cromática queda invertida.
2. **El acento no puede caer cerca del azul del mapa** (~200° tras el
   `hue-rotate` de las teselas), o la ruta se funde con el fondo.

En el mapa se solapan cuatro elementos —trazo, discontinua, hitos y pin de destino—
así que la separación se apoya tanto en el valor como en el tono.

La tipografía vive en [src/components/styles.ts](src/components/styles.ts). Ningún
componente declara fuente, tamaño o peso a mano — todo sale de `text.*`, sobre una
escala de siete pasos (`10 · 11 · 13 · 15 · 19 · 24 · 34`):

| Rol | Familia | Uso |
|---|---|---|
| `displayXl` / `display` | serif 600 | título de la app / títulos de sección y overlay |
| `title` | serif 500 *itálica* | nombre del trayecto en la bitácora |
| `figureXl` / `figure` | serif 500 | cifras principales y secundarias |
| `body` / `bodyStrong` / `bodySm` | Inter | prosa, campos, botones y píldoras |
| `eyebrow` | Inter 500 versalitas | **todas** las etiquetas |
| `caption` | Inter 400 | etiquetas apagadas (pies de dato, barras) |
| `data` | mono | km, cotas, %, coordenadas, fechas |
| `aside` | serif *itálica* | voz del cartógrafo: notas, pistas, advertencias |
| `value` | serif *itálica* | nombres propios de tramos e hitos |

**La cursiva sólo aparece en `aside`, `value` y `title`** — nunca en botones,
subtítulos ni mensajes de error.
