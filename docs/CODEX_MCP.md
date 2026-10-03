# Usar Aldeano Build MCP desde Codex

## Preparación

1. Abre Minecraft Java y el mundo en LAN, puerto **9999**. Para construcción rápida, habilita comandos y modo creativo.
2. En este repositorio ejecuta `npm install` y `npm run build`.
3. Registra el servidor local:

```powershell
codex mcp add aldeano-build --env BUILD_MODE=fast --env BUILD_FAST_MODE_ENABLED=true --env BUILD_VERIFY=false --env BUILD_AUTO_REPAIR=false -- node C:\Users\Aldea\Desktop\Aldeano-Build-MCP\dist\main.js --host 127.0.0.1 --port 9999 --username CodexBuilder
codex mcp get aldeano-build
```

Abre una nueva sesión de Codex para cargar las herramientas registradas. La configuración de un servidor no añade herramientas automáticamente a una conversación que ya está abierta. Si cambia el puerto LAN, actualiza el registro.

## Flujo de construcción

- Lee el encargo desde `C:\Users\Aldea\Desktop\plan.txt` con UTF-8. Investiga referencias y diseña antes de ejecutar.
- En esta sesión, el usuario solicita teletransporte para todos los desplazamientos de los bots en fast/creative; no caminar al sitio. Mantén destinos acotados, comprueba la llegada y los datos de bloques. Nunca añadas una herramienta de comandos arbitrarios.
- Inspecciona obligatoriamente el volumen del sitio mediante datos de bloques. Solo aire cuenta como vacío; posiciones no cargadas no cuentan como libres.
- Usa `world.scan-region` con `detail: "summary"`; evita respuestas `full` salvo necesidad concreta.
- Usa `build.preview`, luego `build.blueprint` con un diseño estructurado y `verifyAfterBuild` explícito. La configuración anterior desactiva la revisión por defecto; un encargo que pide revisión puede activarla.
- Consulta `check-build` mediante el ID devuelto; usa `build.pause`, `build.resume` y `build.cancel` según sea necesario.
- No solicites PNG salvo petición explícita de imágenes o revisión visual.
- Para megaestructuras, divide el diseño en secciones que respeten los límites configurados. El registro anterior conserva los límites del core: no permite enviar cualquier tamaño sin planificación.
- Mantén coordenadas, compresión, colas y reintentos en el motor. Dedica el contexto del modelo a investigación y diseño, no a miles de comandos individuales.
- Los scripts paralelos existentes usan conexiones independientes y regiones exclusivas. Registrar el MCP no convierte automáticamente `build.blueprint` en el ejecutor paralelo de esos scripts.

## Herramientas principales

`world.scan-region`, `world.get-block`, `world.get-environment`, `build.preview`, `build.blueprint`, `build-wall`, `build-floor`, `build-hollow-box`, `check-build`, `verify-build`, `repair-build`, `build.history`.

El plan del esqueleto requiere rotulación, circulación a distintas alturas y revisión anatómica. La instalación del MCP por sí sola no construye el modelo ni certifica su precisión anatómica.

## Diagnóstico

`codex mcp get aldeano-build` confirma el registro; no confirma conexión a Minecraft. Comprueba la conexión con `world.get-environment` en una sesión con las herramientas cargadas. Si falta conexión, revisa Minecraft abierto, puerto LAN, permisos y nombre del bot.

Referencia de configuración: https://learn.chatgpt.com/docs/extend/mcp?surface=cli
