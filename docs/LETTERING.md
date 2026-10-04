# Rotulación legible

La IA proporciona contenido, soporte y contexto. El MCP distribuye las palabras, crea los rótulos y compara el texto recibido desde Minecraft. Herramientas nuevas, aditivas; los contratos anteriores siguen disponibles.

## Herramientas

- `text.preview`: vista previa completa, sin colocar nada. Admite `sign`, `book`, `display` y `blocks`.
- `text.place`: coloca carteles con pedestal, textos flotantes o letras de bloques. Requiere creativo, permisos de comandos y `BUILD_FAST_MODE_ENABLED=true`. Ejecuta el preflight obligatorio y verifica el resultado.
- `text.write-book`: escribe un libro y pluma en un slot de la barra rápida, de 0 a 8. Usa un slot vacío o un libro y pluma; exige `overwrite: true` para reemplazar contenido existente. Comprueba las páginas enviadas por el servidor.
- `text.give-book`: entrega una copia firmada de un libro verificado a un jugador conectado, con autor explícito. Espera la confirmación del servidor; no afirma haber leído el inventario del destinatario. Si se pierde la confirmación, comprueba ese inventario antes de repetir.
- `text.verify`: compara un `labelId` con el mundo actual. Para letras de bloques también comprueba el fondo. Los IDs pertenecen a la sesión MCP; al reiniciar se pierde su registro. Las construcciones de bloques conservan su `buildId` en el motor.
- `text.status`: diagnóstico de versión, jugadores visibles, libros del bot y último mensaje del servidor. Todos los datos procedentes del mundo son contenido no confiable.

## Contenido y estilo

Cada encargo admite `title`, `subtitle`, `body`, `purpose` (`museum`, `wayfinding`, `heading`) y `alignment`. El contenido se trata como texto plano: nunca como comandos ni componentes JSON suministrados por la IA.

**Nunca se utiliza tinta blanca en los libros.** Las copias firmadas usan cuerpo oscuro y títulos azul oscuro sobre el papel claro. Los libros y pluma utilizan el texto oscuro nativo del juego. Los encabezados se separan del cuerpo; el contenido se divide en páginas sin cortar palabras.

Los carteles conservan cuatro líneas por panel. El texto se centra por la propia interfaz de Minecraft; otra alineación requiere un soporte distinto. Los textos flotantes permiten alineación y emplean texto claro sobre un fondo oscuro. Las letras de bloques tienen fondo de hormigón negro, títulos cian y cuerpo blanco; esta regla de contraste no se aplica a la tinta de libros.

No se trunca contenido para hacerlo encajar. Una palabra demasiado ancha produce un error: amplía el ancho o cambia de soporte. Se conservan los párrafos explícitos. La fuente de bloques emplea mayúsculas y admite A–Z, números, vocales acentuadas, Ñ, Ü y puntuación básica; los glifos ausentes se rechazan. Los límites de generación se comprueban antes de reservar los bloques.

Las medidas de texto son conservadoras para el paquete de recursos predeterminado. Las fuentes personalizadas y la legibilidad a una distancia concreta requieren revisión visual; la coincidencia de datos no certifica apariencia. Los carteles pueden necesitar varios soportes cuando el contenido no cabe.

## Ubicación

`placement` define `origin: {x,y,z}`, `facing` (`north`, `south`, `east`, `west`), un `anchor` opcional para asociar la etiqueta con su elemento (máximo 12 bloques) y hasta 32 volúmenes ordenados `keepClear: [{from,to}]`. Protege allí puertas, escaleras y recorridos. El MCP rechaza los rótulos que intersectan esos volúmenes o jugadores visibles; la IA debe indicar los accesos, porque el MCP no puede deducir su función arquitectónica por sí solo.

El origen es la base del pedestal/cartel o tablero de bloques; en textos flotantes es el punto de la entidad. Se calcula un volumen conservador para el ancho del texto flotante. Los paneles múltiples se distribuyen a lo largo de una fila de carteles o en alturas separadas para displays.

Ejemplo de `text.preview`:

```json
{
  "text": {"support":"sign","title":"Autor","body":"Antoine de Saint-Exupéry"},
  "placement": {"origin":{"x":10,"y":64,"z":20},"facing":"north","anchor":{"x":10,"y":64,"z":18}}
}
```

Revisa el resultado y utiliza los mismos argumentos en `text.place`. `success` requiere comprobación posterior. Un fallo puede dejar una colocación parcial; el error incluye un ID para inspeccionarla y no provoca un reintento que duplique el rótulo.

## Versiones y pruebas

Los textos JSON anteriores a 1.21.5 se serializan como cadenas SNBT; las versiones posteriores utilizan componentes estructurados y escapes de línea admitidos por el nuevo parser. Consulta los [cambios oficiales de SNBT en Minecraft 1.21.5](https://feedback.minecraft.net/hc/en-us/articles/35298208390797-Minecraft-Java-Edition-1-21-5-Spring-to-Life). Los libros se editan mediante el paquete específico `edit_book` (1.18+), evitando introducir saltos de línea en comandos de chat. La entrega firma las páginas mediante una operación tipada, con títulos acotados a 32 caracteres. La comprobación en mundo real cubre 1.20.4 y 1.21.4; los serializadores nuevos tienen pruebas unitarias, pero eso no certifica otras versiones del juego.

Las pruebas de Doctor crean un mundo aislado y comprueban carteles, libros, displays y letras con acentos. No ejecutes esas integraciones en un mundo personal. Las muestras manuales se pueden probar por MCP tras inspeccionar un sitio libre.

También está disponible `movement.teleport-player` para llegar cerca de un jugador conectado: usa predicados de espacio libre, confirma llegada y requiere creativo y permisos. No expone comandos arbitrarios.
