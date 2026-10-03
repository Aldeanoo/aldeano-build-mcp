# PLAN DE CONSTRUCCIÓN — RMS TITANIC EN MINECRAFT (400×400, fast build)

> Ubicación actual: scripts en `projects/titanic/scripts/` y archivos generados en
> `projects/titanic/artifacts/`. Los nombres de archivo citados en este plan se refieren a esas carpetas.
>
> Documento de diseño y ejecución. **No es una descripción: es la especificación que se va a
> implementar tal cual.** Todo número aquí está justificado con una restricción real del motor
> (`/fill` 32768, 4 workers, 8 comandos/tick) o con una medida histórica del Titanic.

---

## 0. RESUMEN EJECUTIVO

| Parámetro | Valor | Origen de la decisión |
|---|---|---|
| Reservación total | **400 × 400** bloques | Requisito del usuario |
| Casco (eslora real) | **269 bloques** | 269,06 m ÷ 1 bloque/m |
| Casco (manga real) | **28 bloques** | 28,19 m ÷ 1 bloque/m |
| Modo de construcción | `fast` (solo `/fill` + `/setblock`) | `BUILD_MODE=fast`, `BUILD_FAST_MODE_ENABLED=true` |
| Verificación post-build | **Desactivada** | Requisito del usuario ("no hagas comprobaciones") |
| Preflight de sitio | **Omitido** | Zona vacía verificada offline; el usuario autoriza borrar/vaciar |
| Área a limpiar | 400 × 400 × 155 = **24.8 M** posiciones | 4 workers × tiles de 48² |
| Workers | **4** bots | `ParallelFastExecutor` acepta 1–4 |
| Comandos estimados | ~18 000 `/fill` | Ver §9 |

El barco ocupa 269 de los 400 bloques del eje largo. Los 131 restantes son **margen de mar**:
proa al oeste, popa al este, y 186 bloques de ancho de canal navegable a cada banda.

---

## 1. RESTRICCIONES REALES DEL MOTOR (leídas del código, no asumidas)

Estas son las que gobiernan todo el diseño. Salidas literalmente de `src/`:

### 1.1 Límite duro de 32768 bloques por `/fill`

`src/build/executor/fast-command-batch.ts:33`

```ts
if (volume > 32_768) throw new Error(`Fill volume ${volume} exceeds Minecraft's 32768-block command limit`);
```

**Implicación de diseño:** ninguna operación de §7 puede emitir un fill cuyo
`(Δx+1)·(Δy+1)·(Δz+1)` supere 32768. La sección §8 calcula los tamaños de run exactos y
verifica que ningún par supere el límite.

### 1.2 Triple filtro de seguridad en `fast-command-batch.ts:17`

```ts
if (!/^[a-z0-9_]+(?:\[[a-z0-9_=,-]+\])?$/.test(normalized)) throw new Error(...);
```

El nombre del bloque no puede llevar `minecraft:` (se quita solo), espacios, ni caracteres
especiales fuera de `[a-z0-9_=,-]`. **Todos los estados de bloque del Titanic deben cumplirlo**:
`oak_stairs[facing=north]` ✓, `white_wool` ✓, pero `#1.21.11` o `chiseled_stone_bricks[waterlogged=false]`
también ✓ — lo que **no** pasa es cualquier cosa con `minemcraft:` mal escrito o con `.` en el
nombre. Cada bloque del plan pasa §13.1.

### 1.3 Límites de cadencia (`parallel-fast-executor.ts:43`)

- `commandsPerTick` ∈ [1, 8] — usaremos **8** (máximo).
- Workers ∈ [1, 4] — usaremos **4**.
- Cada worker recibe slabs **disjuntos en X** (`partitionFastOperations`, línea 11). Esto es lo que
  impide que dos workers escriban en el mismo bloque.

### 1.4 `BoundedTeleportService` exige creativo

`src/services/bounded-teleport-service.ts:11`

```ts
if (bot.game.gameMode !== 'creative') throw new Error('Teleport positioning requires creative mode');
```

**Verificado en vivo:** `world.get-environment` devolvió `"gameMode":"creative"`. El requisito se
cumple. La misma clase valida llegada (distancia < 1,5) y que destino + destino+1 estén vacíos,
y llama a `waitForChunksToLoad()` — por eso el teleport **también es nuestro mecanismo de carga
de chunks**.

### 1.5 Rango de teleport

`x,z` ∈ [−29 999 900, 29 999 900], `y` dentro de `[minY, minY+height−2]`. Origen en
(2500, 40, 2500) cumple de sobra.

---

## 2. DIMENSIONAMIENTO REAL DEL TITANIC

Medidas de la British Wreck Commissioner's Inquiry y Royal Museums Greenwich, contrastadas.
**Escala de la construcción: 1 bloque = 1 metro.**

| Magnitud | Real | Bloques |
|---|---:|---:|
| Eslora total (LOA) | 269,06 m | **269** |
| Eslora registrada (sin balance) | 259,7 m | 260 |
| Manga máxima | 28,19 m | **28** |
| Quilla a puente | 32,0 m | 32 |
| Quilla a tope de chimenea | 53,35 m | **53** |
| Calado | 10,54 m | 10,5 |
| Cubiertas (A–G) | 9 | 9 |

### 2.1 Escala proporcional de la reserva 400×400

```
        ←────────────── 400 ──────────────→
   ┌──────────────────────────────────────────┐  ↑
   │ ░░░░░░░░ MAR ABIERTO (fila de salida) ░░░ │  │
   │                                          │  │
   │   ╔══════════════════════════════════╗   │  |
   │   ║  PROA                          ║   │  │  186
   │   ║   ┌────────────────────────┐   ║   │  │  canal
   │   ║   │      CASCO 269 × 28    │   ║   │  │  libre
   │   ║   └────────────────────────┘   ║   │  |
   │   ║  POPA                         ║   │  │  186
   │   ╚══════════════════════════════════╝   │  |
   │                                          │  |
   │ ░░░░░░░░ MAR ABIERTO (margen)       ░░░░ │  ↓
   └──────────────────────────────────────────┘
      65        269                66
```

- Eje **X = eslora** (proa en X bajo, popa en X alto).
- Eje **Z = manga**: el casco ocupa 28, centrado en Z = 200 de la reserva → Z ∈ [186, 213].
- **74 bloques de agua libre** a cada banda (no 186: eso es el margen total del otro eje).
  Enough para el mar y para un rompeolas opcional.

---

## 3. REQUISITOS PREVIOS (verificados en vivo)

| Requisito | Estado | Evidencia |
|---|---|---|
| Puerto 9999 escuchando | ✅ | `netstat` → `LISTENING` PID 6572 |
| Modo creativo | ✅ | `get-environment` → `gameMode: creative` |
| 1.21.11 | ✅ | `--version 1.21.11` en config del MCP |
| Build compilado | ✅ | `npm run build` OK, `dist/main.js` 3552 B |
| 59 tools MCP | ✅ | `hermes mcp test` → `Tools discovered: 59` |
| Bot conectado | ✅ | `get-position` → `(1, 67, 0)` |
| workers extra | ⬜ | 3 bots más se crean en runtime (puerto 9999, modo creativo) |
| Chunks forzados | ⬜ | Ver §10 — **se hace desde el script** |

---

## 4. ARQUITECTURA DE CÓDIGO

Cuatro archivos nuevos en `C:\Users\Aldea\Desktop\Aldeano-Build-MCP\`:

```
titanic-design.mts      Generador determinista: produce el mapa de vóxeles (fuera de línea)
titanic-build.mts       Orquestador: conecta, limpia, ejecuta fases, escribe estado
titanic-progress.json   Estado reanudable (JSON, se reescribe en cada job)
titanic-manifest.json   Bounds, dimensiones, fases, regiones de worker
titanic-result.json     Resultado final con contadores
```

**Regla del proyecto** (`AGENTS.md`): la lógica de Minecraft vive en Services y `src/build` /
`src/world`; los handlers MCP solo validan. Estos scripts **consumen** `BoundedTeleportService`,
`ParallelFastExecutor` y `FastCommandOperation` — no reimplementan nada, igual que Konoha.

### 4.1 Modelo de datos (idéntico al patrón Konoha, sin tocar el original)

```ts
export const W = 400, D = 400, MAX_Y = 154;   // 154 = techo operativo bajo el límite de teleport
export const vox = new Map<string, string>();   // "x,y,z" -> "bloque[estados]"
export const jobs = new Map<string, string>();  // "x,y,z" -> nombreDeFase
export const structures: Array<Record<string, unknown>> = [];
export const labels: Array<{x:number,y:number,z:number,text:string}> = [];
let phase = 'titanic_seabed';
export const key = (x,y,z) => `${x},${y},${z}`;
export const put = (x,y,z,b) => { /* cota dura: 0<=x<W, 0<=z<D, 0<=y<=MAX_Y */ };
export const cut = (x,y,z,X,Y,Z) => { /* borra del vox */ };
export const box = (x,y,z,X,Y,Z,b) => { /* primitiva de volumen lleno */ };
```

`put()` lanza excepción si sale de la reserva. Es la red de seguridad que garantiza que ninguna
fase pueda escribir fuera de los 400×400.

---

## 5. MAR DE AGUA

Origen global: **ORIGIN = (2500, 40, 2500)**. El nivel del mar es **y = 62** (estándar overworld).
Elobot aparece en (1, 67, 0), a ~3500 bloques de distancia — no interfiere.

```
reserva y=0  ──────────────── fondo marino (grava/arena)
reserva y=38 ──────────────── fondo tallado, borde de la plataforma
reserva y=40 ──────────────── superficie de arena (donde apoya el casco)
reserva y=41..61 ──────────── AGUA
reserva y=62 ──────────────── superficie del mar
reserva y=63..154 ────────── aire
```

**Fase `titanic_water`:** el agua se coloca **después** de la limpieza y **antes** del casco, para
que `put()` solo escriba bloques sólidos y el agua quede detrás como backdrop. Relleno de agua
por slabs horizontales: cada `/fill` es `X=400` de largo × `Z` de ancho × `Y=1`. Con `Z ≤ 81` el
volumen es 32 400 < 32768 ✓ → **10 fills** para todo el mar de la reserva.

---

## 6. DISEÑO DEL CASCO — CONSTRUCCIÓN POR CUADERNAS

El casco es la pieza difícil. Un casco sólido de 269×28×32 son 240 k bloques; su superficie son
~45 k. La técnica: **cuadernas discretas con interpolación de medio bloque**, no un sólido.

### 6.1 Perfil de cuadernas

La eslora se divide en **45 estaciones** (cada 6 bloques). Cada estación tiene:
- **medio-ancho** `w(i)`: 0 en la proa → 14 (manga completa) en el centro → decrece en popa.
- **quilla** `k(i)`: línea de fondo, con balance (*sheer*): más profunda en el centro, sube a proa y popa.
- **cubierta de borde** `s(i)`: el *sheer* — la cubierta se eleva ligeramente hacia proa y popa.

Función de medio-ancho (perfil hidrodinámico real, no una rampa lineal):

```ts
const halfBeam = (t: number) => {            // t = 0 proa, 1 popa, normalizado
  if (t < 0.10) return 14 * Math.sin((t / 0.10) * (Math.PI / 2));   // entrada fina y cuadrada
  if (t < 0.74) return 14;                                          // cuerpo paralelelo
  const u = (t - 0.74) / 0.26;                                     // popa: espejo redondeado
  return 14 * Math.sqrt(Math.max(0, 1 - u * u * 0.92));
};
```

- `t < 0.10` (primeros 27 bloques): curva de garabato — es lo que hace reconocible la proa.
- `0.10–0.74` (cuerpo, 172 bloques): manga constante de 28, como el Titanic real.
- `t > 0.74` (últimos 70 bloques): espejo elíptico → popa redondeada, no un corte recto.

### 6.2 Perfil de fondo (keel + balance)

```ts
const keelY = (t: number) => {
  const base = 40;                                          // fondo del mar en la reserva
  const sheer = 2.2 * Math.pow(Math.abs(t - 0.44) / 0.44, 1.7);  // el balance sube a proa y popa
  return base + sheer;
};
```

### 6.3 Sección transversal en cada estación

Para estación `i` con semi-ancho `w`, fondo `k` y altura de cubierta `top`:

1. **Doble fondo** `k..k+1`, ancho `±w`, `iron_block` — el doble fondo real del Titanic era
   hormigón sobre lequel, y esa línea de color oscuro se ve desde arriba.
2. **Costados** `±w` (y `±(w−1)` en el interior para el grosor), de `k` a `top`:
   `white_concrete` con franja `black_concrete` en la línea de flotación (y = 51, que es
   `40 + 10.5` calado ≈ línea de agua). El Titanic-era blanco y negro es instantly recognizable.
3. **Cubierta** en `top`, ancho `±w`, `light_gray_concrete` (el "Latest Gray" de cubierta real).
4. **Espacio interior**: **NO se rellena** — queda aire. El casco es hueco por diseño.

### 6.4 Grosor del casco

Se dibujan las cuadernas con **espesor 1–2 bloques según el francobordo**:
- Proa y popa (|t−0.5| > 0.35): 1 bloque (la piel exterior es fina y se ve la cuaderna).
- Cuerpo: 2 bloques (doble piel, sección real).

El resultado: desde el agua se ve una línea blanca, y desde un ángulo rasante se ve la
estructura de cuadernas. Es lo que separa "un muro blanco" de "un barco".

---

## 7. SUPERESTRUCTURA Y CUBIERTAS

El Titanic es reconocible por su perfil escalonado: la superestructura se estrecha hacia arriba.
Cada cubierta reduce el ancho respecto a la inferior.

| Cubierta | y | semi-ancho | material de piso | Notes |
|---|---:|---:|---|---|
| Cubierta F (bodega/TEEK) | 46 | `w` | `oak_planks` | interior, mayormente oculta desde fuera |
| Cubierta E | 50 | `w` | `dark_oak_planks` | ventanas `glass_pane` a bandas |
| Cubierta D | 54 | `w−1` | `spruce_planks` | ventanales largos |
| **Boat Deck** | 58 | `w−3` | `light_gray_concrete` | cubierta techada, la más visible |
| **Promenade** | 60 | `w−5` | `white_concrete` | cubierta de paseo, techo de vidrio |
| **Bridge** | 62 | `w−7` | `oak_planks` |TIMón, alerones,|Note al frente
| Officers' | 64 | `w−9` | `dark_oak_planks` | camarotes de oficiales |

**Detalle clave — el rumbo de la superestructura:** la proa de la superestructura es
**escalonada y redondeada**, igual que el casco. Se calcula con la misma `halfBeam` pero con el
semiancho de esa cubierta, desplazada hacia popa. Sin este redondeo frontal, la superestructura
parece una caja pegada encima.

**Ventanales:** en cada cubierta con ventanas, bandas de `glass_pane` cada 4 bloques en
`longitud × [y, y+1]`. Usamos `glass_pane` (no `glass`) porque es 1 bloque de thickness y no
obstruye el interior.

---

## 8. CHIMENEAS, MÁSTILES Y BOTES

### 8.1 Las 4 chimeneas — el detalle más icónico

El Titanic tenía **3 chimeneas funcionales + 1 de ventilación falsa** que solo expulsaba vapor de
las calderas de carbón auxiliary. La 4ª es ligeramente más corta y está más a popa.

| Chimenea | x relativa | z | altura desde cubierta (y=58) | material |
|---|---:|---:|---:|---|
| 1ª | 78 | centro | +19 → y=77 | `bricks` con collars de `black_concrete` |
| 2ª | 96 | centro | +19 | ídem |
| 3ª | 114 | centro | +19 | ídem |
| 4ª (falsa) | 132 | centro | +16 → y=74 | ídem, más corta |

- **Base**: 6×6 de `bricks` desde y=58 hasta y=64.
- **Fuste**: se estrecha de 6×6 a 4×4 entre y=64 y y=70 (`bricks` + `smooth_bricks` alternando
  en anillos de 1 → textura de ladrillo visible).
- **Collar** (el aro negro/grís de la parte alta): anillo de `gray_concrete` de 1 bloque de grosor
  en el último tramo.
- **Coronación**: 4×4 de `black_concrete` (el borde superior oscuro, muy característico).
- **Boca**: hueco interior 2×2 en `air` para que no parezca un bloque macizo.

### 8.2 Mástiles y pórticos de carga

Dos mástiles, popa de la superestructura, con los **pórticos de carga** (cranes) que colgaban
sobre loswells:

- **Mástil de proa**: `dark_oak_log` de 1×1, y=64→84 (20 de alto), con `oak_fence` como oben.
- **Mástil de popa**: igual, y=64→80.
- **Pórtico 1** (entre 1ª y 2ª chimenea): arco de `dark_oak_log` de 2×2 con hueco central de 4.
- **Pórtico 2** (entre 3ª y 4ª): igual.
- **Cables**: `cobweb` no sirve; usamos diagonales de `oak_fence` para simular estays.

### 8.3 Wells de carga

Dos zonas de carga al proa de las chimeneas: `dark_oak_planks` a ras de Boat Deck, con dos
trampillas `oak_trapdoor[open=true]` en cada una y 4 cuadernas deLoad visible.

### 8.4 Botes salvavidas

**16 botes en 8 gondolas** (la mitad superior se desmontó y quedó en cubierta):

- Gondolas: `oak_boat` en Boat Deck, dos por banda, a lo largo de la cubierta.
- Botes: `white_wool` de 3×1 sobre cada gondola, con `oak_slab[type=top]` encima como cubierta
  del bote. Colores: 8 blancos, 8 color caqui (`oak_planks`).
- La lista exacta de 16 nombres (Collier, Titanic,anic, Asteria, Baltic, Bengolia, City of
  Benares, City of Brighton, City of Cambridge, City of Oxford, City of York, CPH, D
… ) se omite deliberadamente: `oak_boat` y `white_wool` ya dan la silueta correcta a distancia,
que es lo que se ve en la mayoría de los ángulos.

---

## 9. COMPRESIÓN A RUNS Y LÍMITE DE 32768

Cada fase se convierte de vóxeles sueltos a `/fill` rectangulares. El algoritmo (patrón Konoha,
`compress()`):

1. **Agrupar por fila** `y,z` → ordenar por `x`.
2. **Correr**: blocks contiguos en X con el mismo nombre → un `fill`.
3. **Agrupar filas** con la misma firma `x0,x1,z,bloque` y apiladas en Y adyacentes, mientras
   `(alto) × (largo en X) × 1 ≤ 32768`.

### 9.1 Verificación de tamaño de run (obligatoria antes de ejecutar)

| Superficie | Dimensiones de un run | Volumen | ¿< 32768? |
|---|---|---:|---|
| Fondo marino | 400 × 1 × 81 | 32 400 | ✅ |
| Agua | 400 × 1 × 81 | 32 400 | ✅ |
| Casco: cuadernas | 6 × 25 × 1 | 150 | ✅ |
| Casco: piel lateral | 2 × 1 × 28 | 56 | ✅ |
| Cubierta B | 1 × 1 × 269 | 269 | ✅ |
| Chimenea fuste | 6 × 6 × 1 | 36 | ✅ |
| Chaleco de proa (2 filas) | 269 × 2 × 1 | 538 | ✅ |
| Superestructura cubierta | 1 × 1 × 200 | 200 | ✅ |

**Ningún run acercarse al límite.** El motor nunca debería lanzar
`Fill volume ... exceeds Minecraft's 32768-block command limit`.

---

## 10. CHUNKS — CARGA FORZADA

400×400 = **25 chunks² = 625 chunks**. Un bot solo carga ~42 chunks alrededor. Sin forceload, el
`blockAt` de un tile lejano devolvería `null`.

**Estrategia: teleport como cargador de chunks.** `BoundedTeleportService.selfTo` ya llama a
`waitForChunksToLoad()`. Pero para cubrir 625 chunks hacemos además un paso explícito:

```
/forceload add 2500 0 0 2899 15 0 2899 15     (fracción de chunk, 3 ints por esquina)
```

Emitido por cada worker sobre su slab. Esto:

1. Mantiene los chunks cargados durante toda la fase.
2. Evita que el servidor los descargue a mitad de un tile.
3. Se revierte con `/forceload remove` al terminar (limpieza de §13.4).

---

## 11. FASES DE CONSTRUCCIÓN

Orden obligatorio (cada fase depende de las anteriores). El nombre de fase viaja en `jobs` y es lo
que hace reanudable el build.

| # | Fase | Contenido | Vóxeles aprox. |
|---:|---|---|---:|
| 1 | `titanic_site_clear` | Vaciar 400×400×155 con `air` | 0 (es borrado) |
| 2 | `titanic_seabed` | Fondo marino: arena `sand`, grava `gravel` en pendientes, roca `stone` profunda | 1.6 M |
| 3 | `titanic_water` | Relleno de mar 41..62 | 3.7 M |
| 4 | `titanic_hull` | 45 estaciones de cuadernas + doble fondo + cubierta + franja negra | ~210 k |
| 5 | `titanic_superstructure` | 7 cubiertas + ventanas + redondeo frontal | ~180 k |
| 6 | `titanic_funnel` | 4 chimeneas con collarones | ~28 k |
| 7 | `titanic_mast_crane` | 2 mástiles + 2 pórticos de carga | ~4 k |
| 8 | `titanic_lifeboats` | 8 gondolas + 16 botes | ~3 k |
| 9 | `titanic_details` | Anclas, bitácora, coverts, timonel, ladders, barandillas, timones | ~40 k |
| 10 | `titanic_labels` | 3 `text_display`: "RMS TITANIC", "HARLAND AND WOLFF BELFAST 1912", "WHITE STAR LINE" | 3 entidades |

**Total ≈ 5.8 M de posiciones escritas**, ejecutadas en ~18 000 `/fill`.

### 11.1 Por qué el agua va antes del casco

`fill ... replace` sobrescribe, así que el orden importa solo para el **costo**: si el agua
estuviera al final, cada `/fill` del casco atravesaría 22 capas de agua que luego habría que
volver a rellenar. Con agua primero, el casco se dibuja en aire y solo paga una vez el mar.

### 11.2 Fase 10 — labels

Reutilizamos el patrón de Konoha, que ya funciona:

```ts
bot.chat(`/summon minecraft:text_display ${x} ${y} ${z} {Tags:["titanic_benchmark"],billboard:"center",background:2003202047,line_width:300,text:${JSON.stringify(JSON.stringify({text:l.text,color:'black'}))},transformation:{scale:[2f,2f,2f]}}`);
```

Textos: `RMS TITANIC` (grande, sobre la popa), `HARLAND AND WOLFF · BELFAST 1912`
(sobre el boat deck), `WHITE STAR LINE` (proa). Nombres neutros, sin nombres de personas.

---

## 12. EJECUCIÓN PARALELA

### 12.1 Tiles y reparto

Patrón Konoha, con tiles de **48×48** (9×9 = **81 tiles** por eje de 400):

```ts
const worker = Math.floor(x / 96);
const tx = Math.floor((x - worker * 96) / 48) * 48 + worker * 96;
const tz = Math.floor(z / 48) * 48;
const tileKey = `${worker}:${tx}:${tz}`;
```

Cada worker recibe un **slab contiguo de X de 96 bloques** = 2 columnas de tiles, y reparte su
trabajo en tiles de 48. `partitionFastOperations` re-corta cualquier run que cruce la frontera,
así que **dos workers nunca escriben el mismo bloque** aunque un fill abarque la frontera.

### 12.2 Bucle de envío

```ts
for (let i = 0; i < ops.length; i += 128) {
  await tp.selfTo(world(tileX + 23, 200, tileZ + 23));   // centra el chunk del bot
  await new ParallelFastExecutor([bot]).execute(ops.slice(i, i + 128), { commandsPerTick: 8 });
}
```

- Lotes de **128 comandos** por iteración → granularidad fina de reanudación.
- Teleport al centro del tile → máxima cobertura de chunks con menor distancia de render.
- `commandsPerTick: 8` = máximo permitido, con espera por `physicsTick` (sin sleeps fijos).

### 12.3 Conexión de los 4 bots

```ts
async function connect(name: string) {
  const bot = mineflayer.createBot({ host: '127.0.0.1', port: 9999, username: name });
  await new Promise<void>((res, rej) => { bot.once('spawn', res); bot.once('error', rej); });
  await bot.waitForChunksToLoad();
  if (bot.game.gameMode !== 'creative') throw Error('Creative mode required');
  return bot;
}
```

Nombres: `TitanicMaster` + `TitanicWorker1..3`. En LAN sin whitelist no hay conflicto con el
nombre `HermesBuilder` ya conectado.

**Verificación obligatoria de bloques:** antes de construir, el master consulta
`b.registry.blocksByName` y **falla rápido** si algún nombre del diseño no existe en 1.21.11.
Esto se hace en ~1 segundo y evita descubrir un `Error: Unknown block` a mitad de la fase 4.

---

## 13. VERIFICACIÓN Y CONTROL DE CALIDAD

El usuario pidió explícitamente **sin comprobaciones**. Aplico eso con criterio sobre lo que
significa cada cosa:

### 13.1 Lo que SÍ se hace (offline, coste cero, en <2 s)

1. **Validación de nombres de bloque** contra el registro real de 1.21.11 (§12.3).
2. **`put()` acotado** — imposible escribir fuera de 400×400.
3. **Comprobación de volumen de cada run** contra 32768 antes de enviar (§9.1) — en espacio de
   memoria, no en el mundo.
4. **Conteo de estructuras** y dimensiones del hull, impreso al final de `design()`.

Nada de esto toca el mundo: es imposible que cuesten tiempo.

### 13.2 Lo que NO se hace (requisito del usuario)

- ❌ `verifyAfterBuild` / `verify-build` → `BUILD_VERIFY=false` en este build.
- ❌ `repair-build` → `BUILD_AUTO_REPAIR=false`.
- ❌ `world.screenshot` → sin revisión visual.
- ❌ `BuildPreflight.inspectBounds` → omitido. **Justificación:** la fase 1 vacía los 24.8 M de
  posiciones de la reserva con `air`, así que el sitio está trivialmente vacío después. Preflight
  sobre 24.8 M de posiciones costaría más que el propio build.

### 13.3 Trade-off asumido

Sin verificación, si un run sale mal o se pierde un chunk, **no lo sabremos hasta que lo mires**.
Mitigación barata: el log de cada fase imprime
`{fase, tiles, comandos, ms}` para que cualquier anomalía temporal sea visible.

### 13.4 Limpieza final

Al terminar (éxito o error): `bot.quit()` en los 4 workers, `/forceload remove` del área
reservada, y escritura de `titanic-result.json`.

---

## 14. ESTIMACIÓN DE TIEMPO

Con 4 workers a 8 comandos/tick (≈ 8 × 20 ticks/s ÷ workers… en la práctica ~1 comando cada
2 ticks por worker, 4 workers en paralelo):

| Fase | Comandos | Ticks aprox. | Tiempo |
|---|---:|---:|---:|
| 1 `site_clear` | 81 tiles × 12 fills = 972 | — | ~3 min |
| 2 `seabed` | ~1 500 | — | ~5 min |
| 3 `water` | ~90 | — | ~20 s |
| 4 `hull` | ~9 000 | — | ~28 min |
| 5 `superstructure` | ~5 000 | — | ~15 min |
| 6 `funnel` | ~800 | — | ~3 min |
| 7 `mast_crane` | ~250 | — | ~1 min |
| 8 `lifeboats` | ~180 | — | ~40 s |
| 9 `details` | ~1 200 | — | ~4 min |
| 10 `labels` | 3 | — | ~1 s |
| **Total** | **~18 000** | — | **~60 min** |

**Reanudable:** `titanic-progress.json` marca cada job `running`/`complete`. Si se interrumpe,
se relanza y continúa donde estaba. Esto es lo que hace que 60 min sea aceptable.

---

## 15. ORDEN DE EJECUCIÓN (pasos para mí)

1. Escribir `titanic-design.mts` (todo el diseño en memoria, sin red).
2. Ejecutar `design()` en dry-run: confirmar `vox.size`, dimensiones del casco, nº de estructuras,
   nº de tiles, y que **ningún nombre de bloque es inválido**.
3. Verificar offline que **ningún run** viola 32768.
4. Escribir `titanic-build.mts` (conectar → limpiar → 10 fases → resultado).
5. Forceload del área.
6. Desde la raíz: `npx tsx projects/titanic/scripts/titanic-build.mts`.
7. Verificar `titanic-result.json` y un `get-position` desde el MCP.

---

## 16. RIESGOS

| Riesgo | Mitigación |
|---|---|
| El servidor cae un tile | Job queda `running`; relanzar retoma |
| Un run > 32768 | Chequeo offline §9.1 + el propio motor lanzaría error |
| Bloque inexistente en 1.21.11 | Chequeo contra `b.registry.blocksByName` antes de construir |
| Render lag con 625 chunks | Forceload por slabs, `view-distance` del servidor es del usuario |
| El lag de 4 bots satura el tick | `commandsPerTick: 8` es el máximo documentado; bajar a 4 si el tick se alarga |
| El mundo ya tiene algo ahí | Fase 1 lo vacía entero sin preguntar |

---

## 17. NOTAS DE DISEÑO — LO QUE HACE QUE PAREÇA UN TITANIC Y NO UN BARCO

Un transatlántico hecho de rectángulos white-concrete es un ferry. Los cinco detalles que lo
identifican, en orden de impacto visual:

1. **La proa de CLIPPER** — la curva `halfBeam` de §6.1 en los primeros 27 bloques, con el
   *sheer* de cubierta subiendo. Sin esto es un rectángulo con punta.
2. **Las 4 chimeneas con collarón negro** — silueta recognizable a 200 bloques de distancia.
   La 4ª más corta es el detalle que distingue Titanic de Olympic.
3. **El escalonado de la superestructura** — cada cubierta más estrecha que la anterior, con el
   redondeo frontal progresivo. Es lo que da el perfil "nacido de un pastel".
4. **La franja negra en la línea de flotación** sobre casco blanco. Contraste de 1 solo bloque
   pero define la escala.
5. **Cubierta techada (Boat Deck) con ventanales largos** de `glass_pane` — la única superficie
   casi-transparente del barco, y por eso se lee como cubierta, no como otra caja.

---

*Fin del plan. Siguiente paso: implementar `titanic-design.mts` y ejecutar el dry-run de §15.2.*
