# Doctor: un comando para comprobar el MVP

```powershell
npm run doctor
```

Ejecuta, en orden: compilación del producto, comprobación de tipos de código/pruebas/scripts `.ts`, análisis estático de sintaxis e imports de proyectos (también `.mts`/`.mjs`), lint, todos los tests unitarios, todos los tests de integración con Minecraft real y los siete casos de benchmark. El análisis de proyectos no ejecuta sus construcciones ni certifica sus mundos. Continúa después de errores de calidad para entregar el diagnóstico completo; devuelve código 1 si alguna comprobación falla.

Requisitos: dependencias instaladas, Java compatible y `.dev/minecraft/server.jar` preparado con `npm run mc:setup`. La EULA del servidor local debe estar aceptada previamente. Doctor no descarga software ni acepta licencias automáticamente.

## Aislamiento y resultados

Cada ejecución crea `artifacts/doctor/run-<id>/`. Arranca un servidor solo en localhost, en un puerto libre y con un mundo nuevo; concede permisos únicamente a los bots de prueba. Ignora el destino Minecraft del usuario para las acciones de integración y benchmark. No resetea mundos ni ejecuta los proyectos monumentales. Al terminar envía `stop` al servidor que creó. Conserva el mundo y los logs para diagnóstico.

- `artifacts/doctor/latest.md`: resumen legible de la última ejecución.
- `artifacts/doctor/latest.json`: informe estructurado, fases, duraciones y benchmark.
- `run-<id>/benchmark.json`: medidas por caso.
- `run-<id>/*.log`: salidas completas de las comprobaciones y servidor.

La terminal muestra el estado de cada fase y una tabla de benchmark. Los bloques/s incluyen generación, preflight obligatorio, colocación, verificación y reparación, no solo comandos enviados. El informe identifica Node, Minecraft y el ejecutor. Los resultados de una sola ejecución no son una garantía de rendimiento ni una media estadística.

## Opciones

```powershell
npm run doctor -- --offline
npm run doctor -- --checks-only
```

`--offline` ejecuta build, lint, unitarios y los siete benchmarks de planificación, sin Minecraft. El estado es `partial`; no inventa conteos verificados ni velocidad de construcción. Devuelve 0 si las comprobaciones solicitadas pasan. `--checks-only` conserva el diagnóstico rápido de entorno anterior, sin ejecutar suites.

En modo completo, si falta Java, JAR o EULA, la integración queda omitida y el informe falla. Se entrega un benchmark de planificación como diagnóstico, claramente separado del rendimiento real.

Los comandos individuales siguen disponibles para depuración. `npm run test:integration` fuera de doctor conserva su activación explícita mediante `RUN_MINECRAFT_TESTS=true`; doctor la activa automáticamente en su servidor aislado y ejecuta las suites secuencialmente para evitar colisiones de bots.
