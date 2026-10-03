# Origen y atribución

Aldeano Build MCP es un fork modificado de [yuniko-software/minecraft-mcp-server](https://github.com/yuniko-software/minecraft-mcp-server), publicado como repositorio independiente por [Aldeanoo](https://github.com/Aldeanoo). No es una distribución oficial de Yuniko Software ni implica su respaldo.

## Licencia y avisos originales

Se conserva sin reemplazar el archivo [LICENSE](../LICENSE), que contiene Apache License 2.0 y el aviso original `Copyright [2025] [Yuniko Software]`. Se conservan también el historial Git heredado y los avisos de copyright y atribución presentes en el material original. No se afirma autoría exclusiva sobre ese código.

Los archivos heredados modificados llevan un aviso de modificación de Aldeano Build MCP. Los archivos nuevos pertenecen a las contribuciones de este fork y se distribuyen bajo la licencia del proyecto. No se cambia la licencia de las dependencias de terceros: Mineflayer, mineflayer-pathfinder, el SDK MCP y las demás bibliotecas conservan sus respectivos términos.

La sección 4 de [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) establece las condiciones de redistribución, incluida la conservación de la licencia, los avisos aplicables y la identificación de archivos modificados. En la revisión heredada `240c8ce` no existe un archivo `NOTICE`; este documento es una atribución adicional, no una sustitución de un aviso original ni una modificación de la licencia.

## Cambios de este fork

- Capa Services, contratos tipados, módulos de configuración y modos MCP y shell de desarrollo.
- Motor de construcción determinista: primitivas, blueprints, planificación y ejecución acotada.
- Preflight obligatorio de sitio vacío, conteos únicos, verificación, reparación y recuperación.
- API de lectura del mundo, ubicaciones y posicionamiento creativo tipado.
- Organización de proyectos y artefactos, pruebas y benchmarks con Doctor.
- Correcciones de vuelo y mitigaciones de exposición de texto no confiable; [auditoría de issues](upstream-issues.md).

Las demostraciones del original no son una garantía de rendimiento de este fork. Las capacidades medidas, los límites y la forma de reproducir las comprobaciones están en [README](../README.md), [DOCTOR.md](DOCTOR.md), [BUILD_RELIABILITY.md](BUILD_RELIABILITY.md) y [SECURITY.md](SECURITY.md).

## Publicación

Repositorio: [Aldeanoo/aldeano-build-mcp](https://github.com/Aldeanoo/aldeano-build-mcp). El origen se conserva como remoto `upstream`; el repositorio propio utiliza `origin`. Crear un repositorio independiente no crea la relación de fork de la interfaz de GitHub; la atribución permanece explícita en este documento, el README y los archivos heredados modificados.

No se distribuyen mundos locales, credenciales `.env`, dependencias instaladas, compilados ni artefactos generados. Los archivos fuente de proyectos de construcción sí forman parte del repositorio.
