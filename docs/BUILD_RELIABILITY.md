# Construcción fiable: contrato de resultados v2

## Conteo y finalización

El objetivo es el mapa final de coordenadas únicas; la última escritura de una coordenada determina su material y estado. Enviar 6.000 comandos no demuestra colocar 6.000 bloques. `expectedBlocks` debe coincidir con el plan final antes de modificar el mundo.

Un resultado `resultVersion: 2` solo devuelve `success: true`, `status: completed` y progreso 1 cuando la lectura del mundo confirma todos los materiales y estados, sin diferencias ni posiciones ilegibles. `submittedBlocks` cuenta envíos; `placedBlocks` y `verifiedBlocks` cuentan coincidencias comprobadas; `pendingBlocks` incluye diferencias pendientes. Las aperturas exigidas pueden añadir diferencias aunque todos los sólidos coincidan.

Estados añadidos: `verifying`, `repairing`, `unverified`. Si se solicita `verifyAfterBuild: false`, los comandos pueden terminar, pero el resultado es `unverified`, `success: false`, cero bloques certificados y nunca un 100% certificado. Antes de construir se sigue preguntando al usuario por esta opción. La comprobación de sitio vacío no es opcional en las herramientas de construcción.

### Migración

Las herramientas antiguas mantienen sus esquemas de entrada. Actualiza consumidores que interpretaban `success` o `placedBlocks` como «comandos enviados»: usa `submittedBlocks` para ese dato. Para declarar un objetivo obligatorio usa la herramienta nueva `build.blueprint.v2`. El `build-roof` antiguo conserva parámetros, pero ahora cierra los hastiales: su conteo geométrico puede cambiar. Vuelve a generar sus planes, no reutilices un número de bloques antiguo.

## Herramientas nuevas

| Herramienta | Entrada / efecto |
| --- | --- |
| `movement.teleport` | `x`, `y`, `z` enteros; TP del propio bot exclusivamente en creativo |
| `build.roof` | `from`, `to`, `block`, `style: flat/gable/hip`, `axis`, `height`, `thickness`, `overhang`, `closeEnds`, `gableBlock`, `ridgeBlock`, `wallTopY`, `wallBlock`, `mode`, `verifyAfterBuild` |
| `build.blueprint.v2` | `blueprint`, `origin`, `expectedBlocks`, `mode`, `verifyAfterBuild`, `design` opcional |
| `build.checkpoints` | Lista identificadores persistidos |
| `build.recover` | `buildId`; inspecciona el sitio guardado y ejecuta solo las posiciones pendientes |

Reinicia el MCP para registrar las herramientas nuevas después de compilar.

## Techos y contratos de diseño

La preparación arquitectónica ocurre **antes** del conteo final, el preflight y cualquier colocación. En blueprints de edificios, marca muros con `category: "wall"` y cubiertas con `category: "roof"`. Cuando una columna tiene un muro y su primera cubierta encima, el planificador prolonga el material macizo del muro por la franja que falta, conserva bloques ya definidos y deja hueco el interior. Un cierre que invade `requiredAir` se rechaza antes de construir. Los planos sin categorías no proporcionan intención suficiente para inferir muros: no se adivinan recintos en esculturas ni se cierran automáticamente patios o cubiertas posteriores sin sus propios muros.

`build.roof` añade `wallTopY` (Y del último bloque del muro existente) y `wallBlock` (material del cierre). `from`/`to` delimitan la huella del muro, `from.y` inicia la cubierta y `overhang` extiende solamente el alero. El generador cierra la franja vertical en la huella original, no en el borde exterior del alero. `closeEnds: false` conserva abiertos los triángulos por encima del arranque. Hastiales, respaldo y cumbreras usan materiales macizos derivados del material o seleccionados explícitamente; no tratan una escalera como un cubo completo.

Las losas estructurales se resuelven considerando las superficies de los vecinos: `top` para contactar por arriba, `bottom` por abajo y `double` cuando ambas caras requieren contacto. La resolución es simultánea e independiente del orden de entrada. Las losas dobles no quedan anegadas. Marca una losa `category: "decoration"` para conservar una separación intencional. Esto no es un cálculo de cargas ni añade columnas debajo de elementos aislados.

`requireConnected` utiliza cajas de colisión del estado y versión de Minecraft, con contacto de área positiva; la vecindad entre coordenadas deja de certificar contacto a través de medio bloque vacío. La colocación física de losas usa clics en la mitad solicitada, dos piezas para una losa doble y comprueba el estado devuelto por el servidor. Si otro estado explícito no puede garantizarse en modo físico, falla antes de excavar, en lugar de ignorarlo; fast/cinematic conserva sus estados explícitos.

### Migración de preparación arquitectónica

Las entradas antiguas siguen siendo válidas; `wallTopY` y `wallBlock` son parámetros opcionales nuevos de `build.roof`. `build.preview` y `blueprint.validate` informan el conteo **corregido** y los ajustes en `warnings`. Regenera `expectedBlocks` con ese conteo: un número anterior al cierre se rechaza antes de modificar el mundo. Los checkpoints ya guardados y los planes de transporte no se reinterpretan; conservan su estado final exacto. Los consumidores de bajo nivel de `ParallelFastExecutor` deben llamar a `prepareArchitecture` sobre el plan completo antes de comprimir o dividir en fases; no se corrige una fase aislada que no conoce sus vecinos.

Después de compilar, reinicia el MCP para cargar el planificador y el esquema actualizado. Compilar no sustituye el proceso que ya está ejecutándose.

Los techos cubren cada columna de la huella; los de dos aguas cierran extremos sin rellenar por defecto el interior. Admiten grosor, aleros y orientación de escaleras. La altura se acota según la luz para no introducir saltos verticales. Para escaleras usa un material macizo en `gableBlock` y `ridgeBlock` cuando quieras extremos y cumbrera macizos.

`design` puede exigir `roofBounds`/`roofBaseY`, `requiredSupports`, `requiredAir` y `requireConnected`. La validación previa detecta columnas sin cobertura, soportes ausentes, aperturas obstruidas y componentes desconectados mediante contacto real entre superficies de bloques vecinos. Es un contrato explícito de geometría voxel, no un simulador universal de física ni una certificación automática de circulación. Las posiciones de `metadata.design` son relativas al blueprint; las de `design` pasado como opción son coordenadas de mundo. El aire exigido debe estar dentro del volumen inspeccionado y también se revisa al finalizar.

## Verificación, reparación y progreso

La verificación visita sectores, carga chunks y lee bloques; `null` siempre queda pendiente, nunca equivale a aire. Repara solo diferencias legibles y vuelve a verificar, con `BUILD_MAX_REPAIR_PASSES` como límite. Si no puede completar, devuelve `partial` o falla con `BUILD_INCOMPLETE` en el ejecutor paralelo. `BuildCompletionService`, `finalizePlacements` y `finalizeVoxels` proporcionan la misma puerta de finalización a los scripts.

`ParallelFastExecutor` verifica por defecto y devuelve conteos finales únicos. Sus trabajadores ocupan franjas exclusivas, mantienen el orden de sobrescritura y paran ante desconexión/cancelación. Un coordinador debe completar el preflight del volumen antes de iniciarlos; el ejecutor de bajo nivel también se utiliza para ediciones autorizadas y no supone por sí mismo que un sitio está vacío.

## TP y seguridad

El posicionamiento rápido combina `BUILD_FAST_MODE_ENABLED=true`, modo fast/cinematic, creativo y `BUILD_TELEPORT_ENABLED=true`. El TP es una operación tipada, acotada al mundo, con condiciones de aire del servidor en pies/cabeza, confirmación de llegada y comprobación posterior de chunks y despeje. No expone comandos arbitrarios. Un destino remoto no cargado o permisos insuficientes pueden causar aborto seguro: nunca se salta el preflight por haber usado TP. Physical/survival conserva navegación física.

## Recuperación

Los checkpoints del motor están en `artifacts/builds/`, con escritura atómica, plan, huella SHA-256, modo, progreso y sectores comprobados. Se guardan tras preflight, lotes y verificación. Se rechazan planes alterados, otro endpoint/dimensión y checkpoints que no aprobaron el preflight. Al recuperar se relee todo el sitio; materiales ajenos abortan en lugar de sobrescribirse. Solo se reenvían posiciones que no coinciden.

La identidad identifica endpoint y dimensión, no un UUID persistente del mundo: tras reemplazar/resetear un mundo en el mismo endpoint no reutilices sus checkpoints. Los scripts históricos mantienen sus propios artefactos; la recuperación persistente estándar es la de `BuildService`, no una migración automática de todos los formatos antiguos. Guarda diseños fuente en `examples/` o `projects/<nombre>/docs/`.

Configuración adicional: `BUILD_TELEPORT_ENABLED` (true) y `BUILD_VERIFICATION_SECTOR_SIZE` (32). TypeScript permite `checkpointDirectory: false` para pruebas; las salidas generadas se mantienen ignoradas por Git.

## Comprobación

`npm run doctor` ejecuta toda la validación y entrega el benchmark en un mundo temporal aislado. Consulta [DOCTOR.md](DOCTOR.md). Incluye fallos de comandos, estados de escaleras, regiones ilegibles, aperturas, preflight fallido, recuperación, techos pares/impares y 6.000 bloques reales.
