# Conectar Aldeano Build MCP a Codex

## Copia y pega esto en tu IA

Pega este mensaje en Codex, dentro de tu editor o terminal de código. Es una instrucción para la IA, no un comando de PowerShell o Bash:

```text
Configura Aldeano Build MCP para usarlo desde Codex:
https://github.com/Aldeanoo/aldeano-build-mcp

Lee AGENTS.md, docs/installation.md y docs/CODEX_MCP.md.
Comprueba Git, Node y Java, descarga el proyecto si hace falta y ejecuta
npm ci (npm.cmd en PowerShell si npm.ps1 está bloqueado).

Pregúntame si usaré el servidor local incluido o un mundo abierto a LAN.
Usa la ruta absoluta real de dist/main.js y el host y puerto de mi mundo.
En LAN, pídeme el puerto que Minecraft muestra al abrir el mundo.
Si uso el servidor incluido, muéstrame la EULA y espera mi aceptación
antes de prepararlo. Conserva mis mundos y mi configuración existente.

Registra el servidor stdio con codex mcp add. Si ya existe ese nombre,
revisa su configuración antes de cambiarlo. Comprueba codex mcp list,
explícame cómo recargar Codex y prueba world.get-environment para
confirmar la conexión sin construir ni borrar bloques.
```

## Registro manual

Completa primero la [instalación](installation.md). Ejecuta desde la carpeta del repositorio, con Minecraft arrancado. El puerto del servidor incluido suele ser 25565; en LAN usa el que muestra Minecraft, que puede cambiar cada vez.

PowerShell:

```powershell
$mcpEntry = (Resolve-Path './dist/main.js').Path
$minecraftHost = Read-Host 'Host de Minecraft (127.0.0.1 si está en este ordenador)'
$minecraftPort = Read-Host 'Puerto que muestra Minecraft o tu servidor'
codex mcp add aldeano-build -- node "$mcpEntry" --host "$minecraftHost" --port "$minecraftPort" --username MCPBot
codex mcp list
```

Bash (macOS/Linux):

```bash
mcp_entry="$(pwd)/dist/main.js"
read -r -p 'Host de Minecraft (127.0.0.1 si es local): ' minecraft_host
read -r -p 'Puerto de Minecraft: ' minecraft_port
codex mcp add aldeano-build -- node "$mcp_entry" --host "$minecraft_host" --port "$minecraft_port" --username MCPBot
codex mcp list
```

`codex mcp --help` muestra las opciones de tu versión. La sintaxis de registro y los servidores stdio están descritos en la [documentación oficial de Codex](https://learn.chatgpt.com/docs/extend/mcp?surface=cli). Para entornos con rutas distintas, resuelve la ruta desde el ordenador donde se ejecutará el proceso MCP.

Recarga Codex o inicia una nueva sesión; en la terminal interactiva puedes consultar `/mcp`. En la extensión del editor, añade un servidor stdio desde sus ajustes MCP y reinicia la extensión. Usa `node` como comando y los mismos argumentos con la ruta absoluta real; el cliente inicia el proceso MCP. Consulta `docs/installation.md` para las limitaciones actuales de versión y autenticación antes de conectar otros servidores.

## Comprobar y construir

Que aparezca en `codex mcp list` confirma el registro. Para comprobar Minecraft, pide `world.get-environment`. Si falla, revisa host, puerto, servidor abierto y que otro proceso no use el mismo nombre de bot.

Antes de construir, inspecciona con `world.scan-region` en modo `summary`, revisa su cobertura y usa `build.preview`. Las posiciones no disponibles no son aire. Pide a la IA un diseño y especifica si quieres validación posterior; consulta `check-build` con el ID devuelto. El modo físico es el predeterminado; la [guía de instalación](installation.md#construcción-rápida-y-tp-creativo-opcionales) explica cómo activar el modo rápido cuando lo necesites.

Las notas históricas del proyecto de anatomía están en [su carpeta de proyecto](../projects/anatomy/docs/codex-session-notes.md); contienen decisiones de aquella sesión, no requisitos de instalación general.
