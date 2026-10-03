# Auditoría de pull requests y dependencias

Revisión del 3 de octubre de 2026 de [Aldeanoo/aldeano-build-mcp](https://github.com/Aldeanoo/aldeano-build-mcp). Los doce PR revisados fueron creados por Dependabot para actualizar dependencias; no eran correcciones de los issues del proyecto original.

## Siete PR recuperados

Los checks antiguos utilizaban una base anterior al commit `e3de807`: dos tests de cancelación trataban `DOMException` como un `Error` ordinario, lo que AVA no acepta en Node 20. La corrección comprueba la identidad del motivo de aborto; no cambia el comportamiento de producción ni omite tests.

Se actualizaron las ramas con la base corregida mediante `update-branch`, sin force-push ni fusionarlas en `develop`. Los catorce jobs de CI siguientes terminaron correctamente:

| PR | Actualización | Node 20 / 22 |
| --- | --- | --- |
| [#1](https://github.com/Aldeanoo/aldeano-build-mcp/pull/1) | actions/setup-node 4 → 7 | [Correctos](https://github.com/Aldeanoo/aldeano-build-mcp/actions/runs/37115885598) |
| [#2](https://github.com/Aldeanoo/aldeano-build-mcp/pull/2) | actions/checkout 4 → 7 | [Correctos](https://github.com/Aldeanoo/aldeano-build-mcp/actions/runs/37115886205) |
| [#4](https://github.com/Aldeanoo/aldeano-build-mcp/pull/4) | yargs 18.0.0 → 18.2.0 | [Correctos](https://github.com/Aldeanoo/aldeano-build-mcp/actions/runs/37115886572) |
| [#7](https://github.com/Aldeanoo/aldeano-build-mcp/pull/7) | mineflayer 4.35.0 → 4.39.0 | [Correctos](https://github.com/Aldeanoo/aldeano-build-mcp/actions/runs/37115885856) |
| [#10](https://github.com/Aldeanoo/aldeano-build-mcp/pull/10) | @typescript-eslint/parser 8.56.1 → 8.71.0 | [Correctos](https://github.com/Aldeanoo/aldeano-build-mcp/actions/runs/37115886070) |
| [#11](https://github.com/Aldeanoo/aldeano-build-mcp/pull/11) | MCP SDK 1.27.1 → 1.31.0 | [Correctos](https://github.com/Aldeanoo/aldeano-build-mcp/actions/runs/37115886799) |
| [#12](https://github.com/Aldeanoo/aldeano-build-mcp/pull/12) | minecraft-data 3.105.0 → 3.117.0 | [Correctos](https://github.com/Aldeanoo/aldeano-build-mcp/actions/runs/37115886803) |

Estos checks cubren instalación, lint, tests unitarios y compilación en Linux. No sustituyen Doctor con Minecraft real para adoptar cambios de gameplay, ni prueban la compatibilidad de todas las actualizaciones combinadas. Los PR permanecen abiertos para revisión; no se activó auto-merge.

## Cinco PR incompatibles cerrados

Se cerraron con una explicación técnica, conservando su historial y las versiones compatibles actuales. No se utilizaron `--force`, `--legacy-peer-deps`, casts para esconder errores ni tests omitidos.

| PR | Causa observada | Qué requiere antes de intentarlo otra vez |
| --- | --- | --- |
| [#3](https://github.com/Aldeanoo/aldeano-build-mcp/pull/3), eslint-plugin-ava 17 | `npm ci`: peer ESLint ≥10; el proyecto usa ESLint 9. | Migrar conjuntamente ESLint, plugin y configuración de reglas. |
| [#5](https://github.com/Aldeanoo/aldeano-build-mcp/pull/5), vec3 0.2 | TypeScript: `angleTo` es obligatorio en 0.2, pero Mineflayer entrega vectores 0.1. | Alinear los contratos reales de vectores y comprobar servicios de bloques y vuelo. |
| [#6](https://github.com/Aldeanoo/aldeano-build-mcp/pull/6), AVA 8 | `ERR_MODULE_NOT_FOUND` al resolver imports fuente `.js` desde tests `.ts`; además elimina soporte Node 20. | Migrar loader/soporte TypeScript y revisar la política de Node. |
| [#8](https://github.com/Aldeanoo/aldeano-build-mcp/pull/8), Zod 4 | `z.record` cambia de argumentos y desaparece `.errors`. | Migración explícita de esquemas, respuestas de validación y regresiones de la API pública. |
| [#9](https://github.com/Aldeanoo/aldeano-build-mcp/pull/9), TypeScript 7 | `npm ci`: fuera del peer range `>=4.8.4 <6` de typescript-eslint 8. | Una cadena de herramientas que admita el compilador y sus cambios. |

No son errores que se solucionen quitando funcionalidades del MCP. Cerrar estos bumps evita adoptar una combinación rota; no significa que las versiones nuevas nunca puedan utilizarse.

## Pendiente de seguridad: npm audit

`npm audit --json`, ejecutado durante esta revisión sobre el lockfile sin actualizar sus dependencias, devolvió código 1 y 33 paquetes afectados: 2 de severidad baja, 8 moderada, 22 alta y 1 crítica. Los recuentos incluyen dependencias transitivas y herramientas de desarrollo; no equivalen a 33 vulnerabilidades únicas ni demuestran que sean explotables desde este MCP.

- La severidad crítica corresponde a `tar@7.5.2`, dependencia transitiva de desarrollo a través de AVA → @vercel/nft → @mapbox/node-pre-gyp, según `npm ls tar --all`. Entre sus avisos figura [DoS por descompresión/parseo sin límites](https://github.com/advisories/GHSA-23hp-3jrh-7fpw). Necesita revisar esa cadena y una versión corregida.
- También hay avisos en la cadena de autenticación de Mineflayer (`prismarine-auth`, `axios`, `uuid`) y en dependencias de HTTP/validación/globs. El transporte utilizado por el producto es stdio; no se afirma que esto elimine todos los riesgos.
- Algunas propuestas de `npm audit fix --force` degradan Mineflayer a 1.4.0 o AVA a 1.4.1. No son una reparación aceptable de este proyecto.

Queda pendiente revisar parches compatibles, actualizar el lockfile y repetir audit y Doctor. No se alteraron dependencias indiscriminadamente dentro de la limpieza de documentación ni se ocultó este resultado. Para reproducirlo:

```sh
npm audit
npm audit --omit=dev
```

Que CI o Doctor pasen certifica sus comprobaciones concretas, no una ausencia de vulnerabilidades.

## Configuración de conexión pendiente

La lectura de [src/main.ts](../src/main.ts), [src/runtime/runtime.ts](../src/runtime/runtime.ts) y [src/bot-connection.ts](../src/bot-connection.ts) detectó que el MCP y la shell utilizan `BotConnection`, cuyo `createBot` solo recibe host, port, username y plugins. El parser valida auth/version y opciones de timeout/reconexión, pero esos valores no gobiernan esta conexión. El nivel de log tampoco se aplica desde la configuración en esos puntos de entrada.

Existe otra ruta con `ConnectionManager` que sí recibe varios de esos valores, pero tenerla implementada no significa que la utilicen el MCP y la shell actuales. Se documenta el defecto sin unificar ni rediseñar runtimes como parte de esta revisión.

La guía usa la configuración local sin autenticación online y no promete login Microsoft o selección explícita de versión. La corrección requiere propagar las opciones y probar los puntos de entrada reales, incluyendo autenticación y reconexión; queda pendiente. No se debe desactivar la autenticación de un servidor de producción para eludirlo.

Una comprobación de arranque mediante el cliente MCP del SDK consiguió inicializar stdio y listar 65 herramientas usando `dist/main.js`. Esto prueba el handshake y registro, no el login online ni las acciones de esas herramientas.
