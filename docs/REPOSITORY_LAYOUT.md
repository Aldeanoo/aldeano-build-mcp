# Organización del repositorio

Aldeano Build MCP es un servidor MCP para Minecraft con adaptadores de herramientas, servicios de juego, un motor de construcción y una API de lectura del mundo. El modo MCP y la shell de desarrollo consumen esas capacidades. Los diseños de construcciones concretas se mantienen aparte, en `projects/`.

Las reglas de creación de archivos están en [AGENTS.md](../AGENTS.md). Este documento describe la estructura y la reorganización de octubre de 2026.

## Mapa de carpetas

```text
src/                    Código del MCP y capacidades reutilizables
  services/             Acciones de Minecraft y contratos de servicios
  build/                Motor de construcción
    primitives/         Geometría determinista
    planner/            Orden y dependencias
    executor/           Colas, comandos y ejecución paralela
    verification/       Preflight, verificación y reparación
    history/            Historial del motor
  world/                Bloques, escaneo, terreno, navegación y capturas
    locations/          Memoria de ubicaciones
  blueprints/           Formato, esquemas, validación y transformaciones
  tools/                Adaptadores MCP y metadatos
  runtime/              Conexiones, sesiones y ciclo de vida
  config/               Configuración y valores por defecto
  logger/               Logging estructurado
  errors/               Errores tipados
  dev/                  Shell, comandos y diagnósticos
scripts/                Utilidades compartidas y tareas del repositorio
  minecraft/            Preparación, arranque y reset del servidor local
  world/                Utilidades de inspección compartidas
projects/<nombre>/      Una construcción por carpeta
  scripts/              Diseño, dry-run, ejecución y utilidades específicas
  docs/                 Planes escritos y notas del proyecto
  artifacts/            JSON generados, estado, informes y capturas locales
examples/               Blueprints fuente pequeños y reutilizables
tests/unit/             Pruebas sin servidor real
tests/integration/      Pruebas de integración y Minecraft
benchmarks/             Casos y runner de rendimiento
docs/                   Guías generales del producto y del repositorio
artifacts/<utilidad>/    Salidas locales de utilidades compartidas
.github/                Workflows y plantillas
.dev/                   Servidor y mundos locales; no borrar para ordenar
dist/                   Código compilado; no editar directamente
node_modules/           Dependencias instaladas
```

Las carpetas de datos locales y salidas están ignoradas por Git. Los artefactos anteriores se conservaron físicamente, incluidos los planes JSON, los estados reanudables y las tres capturas del Titanic. Las subcarpetas `docs/` y `artifacts/` se crean cuando un proyecto las necesita.

## Proyectos actuales

| Proyecto | Contenido |
| --- | --- |
| `anatomy` | Modelos anatómicos, ampliación colosal, accesos, finalización y verificación |
| `cristo` | Construcción y verificación del Cristo |
| `eiffel` | Construcción de la Torre Eiffel |
| `eva01` | Diseño y construcción de EVA-01 |
| `final-valley` | Construcción del Valle del Fin y detalles de circulación |
| `konoha` | Diseño, construcción, cimentación, señalización, rutas y finalización |
| `nyc` | Construcción de Nueva York a gran escala |
| `ps5pro` | Construcción, variantes colosales, dry-runs y diagnósticos |
| `titanic` | Diseño, dry-run, construcción, inspección, capturas y plan escrito |

## Rutas que cambiaron

| Ubicación anterior | Ubicación actual |
| --- | --- |
| Scripts `anatomy-*.mts`, `konoha-*`, `ps5pro-*.mts` y `titanic-*.mts` en la raíz | `projects/<nombre>/scripts/`, conservando sus nombres |
| `capture-titanic.mts` e `inspect-titanic.mts` | `projects/titanic/scripts/` |
| `scripts/build-*.ts` y `scripts/final-valley-details.ts` | `projects/<nombre>/scripts/` |
| JSON de planes, resultados, manifiestos, progreso y auditorías en la raíz | `projects/<nombre>/artifacts/` |
| `titanic-1-proa.png`, `titanic-2-centro.png` y `titanic-3-popa.png` | `projects/titanic/artifacts/` |
| `TITANIC_PLAN.md` | [projects/titanic/docs/TITANIC_PLAN.md](../projects/titanic/docs/TITANIC_PLAN.md) |
| `probe-ground.mts` | `scripts/world/probe-ground.mts` |

Los comandos `npm run build:eiffel` y `npm run build:nyc` conservan sus nombres y usan las rutas nuevas. Los otros scripts se invocan desde la raíz con su ruta completa, por ejemplo `npx tsx projects/cristo/scripts/build-cristo.ts --workers=4`. Ejecutar una construcción requiere la autorización y el preflight descritos en `AGENTS.md`.

Los scripts que leen o escriben estado usan rutas relativas a `import.meta.url`, no al directorio de ejecución. La utilidad compartida `npm run screenshot` guarda por defecto en `artifacts/world/aldeano-world.png`; `--output=<ruta>` permite elegir otro destino. Las capturas requieren una petición explícita del usuario.

## Límites de la limpieza

Se separaron archivos de proyectos y artefactos del código del producto; se actualizaron imports, rutas, comandos y documentación. No se ejecutaron construcciones ni se modificaron mundos durante la reorganización.

Algunos archivos con nombres parecidos no son copias intercambiables:

- `src/config.ts` expone compatibilidad y delega al módulo `src/config/`.
- `src/services/blocks-service.ts` conserva un alias de `BlockService`.
- `src/logger.ts` y `src/logger/logger.ts` tienen implementaciones y consumidores distintos.
- `src/runtime/runtime.ts` y `src/runtime/minecraft-runtime.ts` tienen consumidores y pruebas distintos.
- `src/services/world-service.ts` y `src/world/world-service.ts` cubren APIs distintas.
- Los módulos de errores existentes contienen contratos usados por distintas rutas de importación.

Se preservaron estos módulos. Unificar sus contratos sería una refactorización aparte con revisión de compatibilidad, no una limpieza de carpetas.

La compilación del producto incluye solo `src/**/*.ts`. La configuración general de TypeScript y el lint mantienen comprobaciones para los scripts `.ts` trasladados a `projects/`. Los scripts históricos `.mts` y `.mjs` no formaban parte de esas comprobaciones y necesitan validación específica antes de modificar su comportamiento. Conservar un script o un informe histórico no certifica su seguridad ni el estado actual del mundo.

## Comprobaciones de la reorganización

- `npm run build` y `npm run lint`: correctos.
- `npm test`: 260 pruebas unitarias correctas.
- Análisis estático de los 31 scripts trasladados: sintaxis, imports relativos, rutas de artefactos y entradas npm correctos, sin ejecutar sus acciones.
- Los 20 artefactos trasladados conservaron sus hashes SHA-256.
- `npm run test:integration`: dos casos omitieron sus acciones en Minecraft al no activar `RUN_MINECRAFT_TESTS`. No representa una validación con servidor real.

Durante la reorganización, la comprobación general de tipos (`npx tsc --noEmit`) detectó 15 errores preexistentes en `dev-all.test.ts`, `dev-formatter.test.ts`, `logger-module.test.ts` y `runtime-architect.test.ts`. Después se corrigieron los contratos de estos mocks al integrar la comprobación completa en `npm run doctor`, sin modificar el runtime del producto. Doctor incluye ahora tipos, análisis estático de scripts históricos, suites y benchmarks aislados: véase [DOCTOR.md](DOCTOR.md).
