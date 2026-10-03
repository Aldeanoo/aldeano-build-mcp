# Auditoría de issues del proyecto original

Revisión: 3 de octubre de 2026. Alcance: los cuatro issues abiertos de [yuniko-software/minecraft-mcp-server](https://github.com/yuniko-software/minecraft-mcp-server/issues). Las correcciones son locales a este fork; no se han publicado PR ni cerrado issues del original.

| Issue | Hallazgo en el fork | Tratamiento |
| --- | --- | --- |
| [#272: Stop flying](https://github.com/yuniko-software/minecraft-mcp-server/issues/272) | Cancelar una promesa no detenía el bucle nativo `creative.flyTo`; `stop()` no cancelaba el vuelo. El bucle podía volver a poner gravedad cero después de `stopFlying()`. Además, la parada diferida de pathfinder abortaba el siguiente recorrido. | Sustituido por un bucle por `physicsTick` con cancelación real, timeout, limpieza de listeners y restauración de la gravedad previa. Se limpia también la meta de pathfinder para no dejar su parada pendiente. Nueva herramienta `stop-flying`; caminar, saltar, moverse y TP cancelan el vuelo anterior. Solo creativo, espacio legible y sin bloques; no es navegación aérea alrededor de obstáculos. |
| [#261: Indirect prompt injection](https://github.com/yuniko-software/minecraft-mcp-server/issues/261) | `ChatService.readChat` devolvía `trusted: true`; el adaptador MCP además eliminaba la procedencia y concatenaba texto de jugadores como prosa. | Chat, inventario y entidades legados salen en un sobre JSON con procedencia y `trusted: false`. Controles invisibles eliminados, texto acotado y delimitadores escapados; etiquetas conservadas también en errores de lecturas. `send-chat` ya no permite comandos arbitrarios. Esto mitiga la exposición, no certifica inmunidad del modelo. |
| [#232: Complex builds unreliable](https://github.com/yuniko-software/minecraft-mcp-server/issues/232) | El reporte es general, sin blueprint ni escenario reproducible. El fork ya incorpora el motor fiable v2, no solo llamadas individuales a colocar bloques. | Regresión añadida: casa hueca de varios materiales, entrada, ventanas, techo completo, conteo exacto y reparación de un bloque de techo ausente. Se mantienen además los casos de 6000 bloques, estados incorrectos, sitio ocupado y resultado no verificado. No implica que cualquier diseño generado por una IA o cualquier construcción survival funcione sin errores. |
| [#211: Is demo real?](https://github.com/yuniko-software/minecraft-mcp-server/issues/211) | Los comentarios atribuyen la demo al uso de `/fill` y `/tp` en creativo. No es una prueba reproducible del rendimiento de colocación física ni de este fork. | README aclara el alcance de las demostraciones. La evidencia de este fork es `npm run doctor`: informe, tests reales y benchmarks con bloques esperados y verificados. No se afirma haber reproducido la Casa Blanca ni se recomienda un ejecutor de comandos sin restricciones. |

## Migración de contratos

No se cambian los nombres ni los esquemas de entrada de herramientas existentes. Cambios deliberados de salida y comportamiento:

- `read-chat`, `find-entity`, `list-inventory` y `find-item`: `content[0].text` es ahora JSON `{source, trusted, policy, data}`. Los clientes que parseaban prosa deben usar `JSON.parse(text).data`. Los resúmenes originales permanecen dentro de `data`; mensajes de chat incluyen su propia procedencia. Los errores de estas lecturas y de `world.*` usan el mismo sobre y `isError: true`.
- `send-chat`: solo mensajes normales de una línea, de 1–256 caracteres; rechaza controles y `/` inicial incluso tras espacios. Para posicionar o construir, usar operaciones tipadas `movement.teleport`, `build.*` y las primitivas del motor. Los adaptadores internos acotados siguen disponibles en creativo autorizado.
- `fly-to`: mantiene `x`, `y`, `z`; exige modo creativo real y coordenadas válidas. Comprueba destino y espacio recorrido con bloques; cancela por desconexión, muerte, cambio de modo, obstáculo o timeout de 20 segundos. Devuelve éxito tras dos ticks estables en el destino local; no equivale a un acuse de recibo explícito del servidor.
- `stop-flying`: herramienta nueva, sin argumentos. Cancela el vuelo y restaura gravedad; no aterriza, no hace TP ni promete evitar daño por caída. `MovementService.stop()` también detiene pathfinder y controles.
- `ChatService.readChat`: cada entrada incluye `source: "minecraft_world"` y `trusted: false`. Conteos inválidos, negativos o menores a uno no devuelven historial. `InventoryService.findItem` conserva sus campos, pero elimina la referencia circular `result.item === result`.

## Evidencia reproducible

Ejecutar `npm run doctor`. Incluye automáticamente:

- `tests/unit/upstream-regressions.test.ts`: cancelación, timeout sin ticks, desconexión, muerte, cambio de modo, obstáculos, vuelos simultáneos, vuelta a caminar, límites de chat, comandos rechazados y conservación de la procedencia en MCP.
- `tests/unit/flight-tools.test.ts`: vuelo completo con ticks simulados, llegada y gravedad, sin llamar al bucle nativo no cancelable.
- `tests/integration/upstream-regressions.minecraft.ts`: vuelo y cancelación reales, caída y vuelta a caminar; recepción de un mensaje malicioso de otro jugador como datos; casa completa y reparación del techo.
- Suites de construcción existentes y los siete benchmarks, incluido el caso de 6000 bloques únicos verificados.

Doctor guarda los resultados reales en `artifacts/doctor/latest.md` y `latest.json`, conserva los logs por ejecución y cierra el servidor aislado. No ejecutar estas integraciones manualmente contra mundos de proyectos: sus fixtures crean y limpian bloques.

Validación registrada en esta revisión: ejecución `run-VDfZ8x`, estado `passed`, 297 pruebas unitarias, cinco integraciones reales y siete benchmarks completos. El caso de 6000 bloques verificó las 6000 posiciones. Build, tipos, lint y comprobación estática de scripts también pasaron; el servidor temporal quedó cerrado. Las mediciones corresponden a creativo con compresión, no a colocación survival.

## Límites de seguridad

Escapar delimitadores, quitar controles y marcar procedencia no obliga a un modelo a respetar la frontera de confianza. El cliente debe mantener estos datos fuera de instrucciones privilegiadas y no autorizar acciones porque un jugador, cartel o libro las solicite. No se filtran frases como «ignora las instrucciones»: se conservan como contenido citado para inspección. No se incorporaron lectores nuevos de libros, texto de carteles o NBT de objetos; cualquier futura exposición debe usar la misma frontera. Véase [SECURITY.md](SECURITY.md).
