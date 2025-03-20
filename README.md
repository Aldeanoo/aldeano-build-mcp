# Aldeano Build MCP 🧱

Me gusta hacer cosas en Minecraft, y este proyecto nació principalmente para mis vídeos de YouTube: conectar una IA al juego, probar ideas y montar construcciones que luego pueda enseñar en el canal.

Con Aldeano Build MCP puedes pedirle a una IA que explore el mundo, se mueva y construya contigo en **Minecraft Java**. Aquí comparto las herramientas que uso para que tú también puedas probarlas y hacer tus propias cosas.

[![CI](https://github.com/Aldeanoo/aldeano-build-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Aldeanoo/aldeano-build-mcp/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

## Instálalo con ayuda de una IA

**Copia y pega este texto en el asistente de IA de tu editor o terminal de código.** Usa uno que pueda leer archivos y ejecutar comandos: la IA te ayudará a descargar el proyecto y configurarlo en tu ordenador. Este bloque es una instrucción para la IA; no es un comando para pegar directamente en PowerShell o Bash.

```text
Quiero instalar Aldeano Build MCP para usar una IA en Minecraft Java:
https://github.com/Aldeanoo/aldeano-build-mcp

Descarga el repositorio si aún no está en mi ordenador. Lee AGENTS.md y
la guía docs/installation.md antes de configurar nada.

Comprueba mi sistema y si tengo Git, Node.js y Java compatibles.
Ayúdame a instalar lo que falte y ejecuta npm ci en la carpeta del proyecto.
Si estoy en PowerShell y npm.ps1 está bloqueado, utiliza npm.cmd.

Pregúntame qué asistente de IA quiero conectar y si voy a usar el servidor
local incluido, un servidor existente o un mundo abierto a LAN.
Configura el MCP para ese cliente con la ruta absoluta a dist/main.js
y la dirección, puerto, versión y autenticación de mi Minecraft.

Si elijo el servidor local, muéstrame la EULA de Minecraft y espera a que
la acepte antes de ejecutar npm run mc:setup -- --accept-eula.
Ayúdame a arrancarlo y a conectar el bot. Si necesito iniciar sesión,
indícame cómo hacerlo yo.

Comprueba la conexión con una consulta de posición, sin construir nada.
Al terminar, dime en palabras sencillas cómo entrar al mundo, cómo usar
el asistente y cómo detener el servidor. Si algo falla, revisa el error
y ayúdame a solucionarlo sin borrar mis mundos.
```

Necesitas Minecraft Java y un asistente compatible con MCP, el sistema que permite que la IA use herramientas dentro del juego. La guía incluye un servidor local de **Minecraft 1.20.4** y recomienda **Git, Node.js 24 LTS y Java 21**.

¿Prefieres hacerlo paso a paso? Tienes los comandos y la configuración en la [guía de instalación](docs/installation.md#instalación-manual-paso-a-paso).

## Cosas que puedes probar

- Explorar el terreno y encontrar un sitio para una construcción.
- Crear edificios, esculturas y otras ideas con formas y planos reutilizables.
- Guardar ubicaciones para volver a ellas después.
- Comprobar los bloques de una construcción y reparar partes que falten.
- Pedir capturas isométricas para revisar cómo está quedando.

Por ejemplo: «Mira el terreno y propón un sitio para una casa» o «Diseña una torre con entrada, escaleras y un interior hueco». Antes de construir, el bot comprueba que el espacio esté libre.

Puedes usar construcción física o activar el modo rápido en creativo. El modo rápido necesita configuración y permisos del servidor; la [guía](docs/installation.md#construcción-rápida-y-tp-creativo-opcionales) explica cómo hacerlo.

## Para seguir curioseando

| Quieres… | Dónde mirar |
| --- | --- |
| Instalarlo o resolver un error | [Instalación](docs/installation.md) |
| Ver qué puede hacer la IA | [Herramientas MCP](docs/MCP_TOOLS.md) |
| Preparar construcciones | [Motor](docs/BUILD_ENGINE.md) · [Blueprints](docs/BLUEPRINTS.md) |
| Entender la verificación y reparación | [Construcción fiable](docs/BUILD_RELIABILITY.md) |
| Consultar terreno y capturas | [World API](docs/WORLD_API.md) |
| Comprobar el proyecto | [Doctor](docs/DOCTOR.md) · [Benchmarks](docs/BENCHMARKS.md) |
| Contribuir o tocar el código | [Contribuir](CONTRIBUTING.md) · [Desarrollo](docs/DEVELOPMENT.md) · [Organización](docs/REPOSITORY_LAYOUT.md) |
| Conocer detalles técnicos y límites | [Arquitectura](docs/ARCHITECTURE.md) · [Seguridad](docs/SECURITY.md) · [Issues del original](docs/upstream-issues.md) · [Auditoría de PR](docs/pull-request-audit.md) |

Para ejecutar las comprobaciones, usa `npm run doctor` con el servidor preparado y su EULA aceptada. Genera informes en `artifacts/doctor/` y utiliza un servidor temporal aislado. `npm run doctor -- --offline` hace una comprobación parcial sin Minecraft.

La IA decide el diseño: comprobar los bloques no garantiza que una construcción quede bonita. Las capturas son renders de bloques, y la compatibilidad depende de tu versión de Minecraft. La importación de `.schem`/`.schematic`, el transporte HTTP remoto y la automatización survival completa todavía quedan fuera del alcance. La versión publicada tiene pendientes la propagación de las opciones de autenticación Microsoft y selección explícita de versión; utiliza el servidor local incluido para empezar. Consulta los detalles y los avisos de dependencias en [la auditoría](docs/pull-request-audit.md) y [Seguridad](docs/SECURITY.md).

## Gracias a quienes lo hicieron posible

Este proyecto, mantenido por [Aldeanoo](https://github.com/Aldeanoo), es un fork modificado e independiente de [yuniko-software/minecraft-mcp-server](https://github.com/yuniko-software/minecraft-mcp-server). Conserva los créditos de Yuniko Software y sus colaboradores y la licencia [Apache 2.0](LICENSE). Puedes leer la [atribución y los cambios](docs/attribution.md).

También utiliza [Mineflayer](https://github.com/PrismarineJS/mineflayer), [mineflayer-pathfinder](https://github.com/PrismarineJS/mineflayer-pathfinder) y el SDK de [Model Context Protocol](https://github.com/modelcontextprotocol/typescript-sdk), cada uno con su propia licencia.
