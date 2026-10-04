# Instalar Aldeano Build MCP

## La forma fácil: pídeselo a tu IA

Copia y pega el siguiente texto en el asistente de IA de tu editor o terminal de código. Necesita poder leer archivos y ejecutar comandos para ayudarte a configurarlo. Es un mensaje para la IA, no un comando de PowerShell o Bash.

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

La IA te irá guiando según tu ordenador y el cliente que uses. Tú tendrás que aceptar la EULA si usas el servidor incluido y completar cualquier inicio de sesión que haga falta. Si prefieres instalarlo por tu cuenta, sigue los pasos de abajo.

## Instalación manual paso a paso

Esta es la guía de instalación desde el código fuente. No necesitas una cuenta de IA para comprobar el bot con la shell. Para controlarlo desde una IA necesitas un cliente que admita servidores MCP por stdio.

## 1. Requisitos

- [Git](https://git-scm.com/downloads).
- [Node.js 24 LTS](https://nodejs.org/en/download), con npm incluido. Node 22.12+ también satisface las dependencias actuales; Node 20.19+ se conserva por compatibilidad, pero no se recomienda para una instalación nueva porque ya está fuera de soporte. [Estado oficial de las versiones](https://nodejs.org/en/about/previous-releases).
- [Java 21, por ejemplo Eclipse Temurin](https://adoptium.net/temurin/releases/?version=21). El servidor predeterminado es Minecraft Java 1.20.4 y admite Java 17; otras versiones de Minecraft pueden necesitar otro Java. [Requisitos de Paper](https://docs.papermc.io/paper/getting-started/).
- Internet para descargar las dependencias y el servidor durante la preparación.

Después de instalar, abre una terminal nueva y comprueba:

```sh
git --version
node --version
npm --version
java -version
```

En Windows, si PowerShell bloquea `npm.ps1`, sustituye `npm` por `npm.cmd`; no necesitas cambiar la política de seguridad.

## 2. Descargar e instalar

```sh
git clone https://github.com/Aldeanoo/aldeano-build-mcp.git
cd aldeano-build-mcp
npm ci
```

`npm ci` utiliza las versiones del lockfile y ejecuta la compilación mediante `prepare`. Al terminar debe existir `dist/main.js`. Si cambias código TypeScript después, ejecuta `npm run build` antes de arrancar el MCP compilado.

No uses `--force` ni `--legacy-peer-deps` para esconder incompatibilidades de dependencias. No es necesario instalar el paquete globalmente ni usar `npx aldeano-build-mcp`.

## 3. Preparar Minecraft

### Servidor local incluido

Lee la [EULA de Minecraft](https://www.minecraft.net/en-us/eula). Ejecuta este comando únicamente si la aceptas:

```sh
npm run mc:setup -- --accept-eula
```

Descarga Paper 1.20.4, con fallbacks a otras fuentes oficiales, y prepara `.dev/minecraft/`. Sin aceptación explícita o un `eula.txt` ya aceptado, la preparación se detiene antes de descargar o crear archivos. Las siguientes preparaciones conservan tu `server.properties`; `--force` solo fuerza la descarga del JAR, no resetea el mundo ni los ajustes.

El servidor nuevo escucha en `127.0.0.1:25565`, en creativo y sin autenticación online, solo para pruebas locales. No expongas esta configuración a Internet.

Arráncalo:

```sh
npm run mc:start
```

Espera el mensaje `Done` y deja la terminal abierta. Puedes entrar desde Minecraft Java 1.20.4 en Multijugador → Conexión directa → `127.0.0.1:25565`. Para detenerlo, escribe `stop` en su consola.

### Un servidor existente o un mundo LAN

No necesitas `mc:setup`/`mc:start` si ya tienes un servidor compatible sin autenticación online. Indica su dirección y puerto real. Un mundo abierto a LAN puede asignar un puerto distinto en cada sesión; usa el que muestra el juego.

```sh
npm run dev:shell -- --host 127.0.0.1 --port 25565 --username MCPBot
```

Limitación conocida: la conexión utilizada por el MCP y la shell no pasa `--auth` ni `--version` a Mineflayer, aunque el parser los acepte. Se utiliza la detección automática de versión y el modo de autenticación por defecto de Mineflayer. El login Microsoft y la selección explícita de versión no están habilitados correctamente en estos puntos de entrada. No desactives la autenticación de un servidor de producción para sortearlo; utiliza el servidor local aislado mientras se corrige. [Diagnóstico](pull-request-audit.md#configuración-de-conexión-pendiente).

## 4. Comprobar el bot

En una segunda terminal, entra en la carpeta clonada:

```sh
npm run dev:shell -- --username MCPBot
```

Prueba `pos` y `inv`; usa `quit` para desconectar. No arranques a la vez la shell y el MCP con el mismo nombre de bot. Esta comprobación no construye ni borra bloques.

## Conectar un cliente MCP

Configura en tu cliente un servidor stdio con:

- Comando: `node`, o la ruta absoluta al ejecutable Node si el cliente no lo encuentra.
- Argumentos: ruta absoluta a `dist/main.js` y los parámetros del servidor.
- Directorio de trabajo: la carpeta del repositorio, si el cliente permite configurarlo.

Para clientes que aceptan un archivo JSON con `mcpServers`, una entrada típica es:

```json
{
  "mcpServers": {
    "minecraft": {
      "command": "node",
      "args": [
        "C:/ruta/aldeano-build-mcp/dist/main.js",
        "--host", "127.0.0.1",
        "--port", "25565",
        "--username", "MCPBot"
      ]
    }
  }
}
```

Sustituye la ruta por la de tu clon; en macOS/Linux utiliza su ruta absoluta correspondiente. Reinicia el cliente o recarga sus servidores MCP, según su interfaz. El servidor Minecraft debe estar arrancado antes de pedir acciones. No ejecutes `npm start` en otra terminal para conectar ese mismo bot: el cliente lanza el proceso MCP.

El parser sigue `argumentos CLI > variables de entorno > valores por defecto`. Usa `MC_HOST`, `MC_PORT` y `MC_USERNAME` para la conexión. `MC_VERSION`, `MC_AUTH` y las opciones avanzadas de conexión tienen la limitación indicada arriba; `LOG_LEVEL` tampoco se aplica uniformemente en estos puntos de entrada. `.env.example` es una referencia, no un archivo que el programa cargue automáticamente: proporciona las variables en el entorno o en la configuración de tu cliente.

### Construcción rápida y TP creativo, opcionales

El modo predeterminado es físico. Para habilitar el modo rápido, configura en el entorno del proceso MCP `BUILD_MODE=fast` y `BUILD_FAST_MODE_ENABLED=true`. En un JSON como el anterior pueden ir en un objeto `env` dentro de `minecraft`.

El bot debe estar en creativo y disponer de permisos para las operaciones de construcción y teletransporte. En la consola del servidor local, si quieres darle esos permisos, ejecuta `op MCPBot`. No concedas permisos administrativos a un bot en un servidor ajeno o de producción sin autorización.

El TP es tipado y acotado, comprueba espacio libre y llegada, y no permite omitir el preflight del sitio. No habilites comandos arbitrarios en el chat. Consulta [construcción fiable](BUILD_RELIABILITY.md) para los contratos y límites.

## 5. Todos los tests y benchmark

Con el JAR preparado y la EULA aceptada:

```sh
npm run doctor
```

Doctor arranca su propio servidor temporal aislado; no necesitas arrancar el servidor de tu proyecto. Comprueba build, tipos, lint, todos los tests y siete benchmarks. Los resultados y logs quedan en `artifacts/doctor/`. Consulta [Doctor](DOCTOR.md) para interpretar fallos o usar el modo parcial `--offline`.

## Problemas frecuentes

| Mensaje o síntoma | Qué revisar |
| --- | --- |
| `node`/`npm`/`java` no se reconoce | Instala el requisito, revisa PATH y abre una terminal nueva. |
| `EBADENGINE` o error de Node en yargs | Usa Node 24 LTS; versiones iniciales de Node 20/22 no sirven. |
| `EULA consent required` | Lee la EULA y, solo si la aceptas, añade `-- --accept-eula` a `mc:setup`. |
| No existe `dist/main.js` | Completa `npm ci` o ejecuta `npm run build`; revisa el primer error. |
| `ECONNREFUSED` | Arranca Minecraft, espera `Done` y verifica host/puerto. En LAN usa el puerto anunciado. |
| Puerto 25565 ocupado | Usa el servidor que ya lo ocupa o detenlo de forma normal. No borres mundos. |
| Error de versión o autenticación | Usa el servidor local 1.20.4; la selección explícita y Microsoft están pendientes de corregir. No desactives autenticación en producción. |
| Bot desconectado al conectar otro cliente | Cierra la shell u otro proceso que utilice el mismo username. |
| Modo rápido no disponible | Revisa activación explícita, creativo y permisos; físico no utiliza TP. |
| Tests verdes, pero no hay integración real | `--offline` es parcial; consulta las fases del informe de Doctor. |

No utilices `mc:reset` como solución de instalación: borra datos del mundo local. Conserva los logs y abre un [issue](https://github.com/Aldeanoo/aldeano-build-mcp/issues) con el error y las versiones, sin credenciales.
