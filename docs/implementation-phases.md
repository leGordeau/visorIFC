# Estado de implementación por fases

Este documento mantiene el estado operativo del desarrollo SDD. La especificación
de producto y las decisiones duraderas siguen en
[`docs/spec/ifc-gis-pointcloud-viewer.md`](spec/ifc-gis-pointcloud-viewer.md) y
los ADR.

## Fase 0 — Contexto y especificación

Estado: completada.

- `CONTEXT.md` define el lenguaje del proyecto.
- La especificación cubre IFC, nubes de puntos, GIS, Cesium, DXF, persistencia,
  rendimiento, seguridad y despliegue en GitHub Pages.
- Las decisiones irreversibles están registradas en `docs/adr/`.

## Fase 1 — Shell vertical del frontend

Estado: completada.

- Workspace pnpm con React, TypeScript y Vite.
- Capabilities del navegador y selección local de archivos.
- Manifiesto portable `.pcv.json` descargable.
- Layout preparado para IFClite, Cesium y OpenLayers.
- Separación inicial entre dominio, aplicación, adaptadores e infraestructura.

## Fase 2 — Primer slice IFC con IFClite

Estado: completada localmente.

- Parser columnar de IFClite conectado al flujo de selección IFC.
- Procesamiento adaptativo de geometría con carga por lotes.
- Renderer WebGPU de IFClite conectado a un canvas dedicado.
- Progreso de parsing y geometría, cancelación mediante `AbortSignal` y limpieza
  del renderer al desmontar la vista.
- Compatibilidad Vite configurada para los workers ESM publicados por IFClite.
- Verificaciones ejecutadas: `pnpm -r typecheck` y `pnpm --filter
  @ifc-viewer/app build`.

Observación: el bundle inicial todavía es grande porque IFClite se importa de
forma estática. Se resolverá en la fase de resiliencia/performance mediante
`import()` dinámico y límites de bundle.

### Corrección de carga IFC — 2026-10-17

El smoke test de navegador detectó que Vite devolvía el HTML de la SPA cuando
el glue WASM resolvía el binario desde el directorio de dependencias optimizadas.
Compilar sin errores no había validado este flujo en ejecución.

- Se importa el binario mediante `?url` y se inicializa explícitamente antes del
  procesador. Los workers reciben la misma URL.
- La selección de archivos espera al motor listo; los errores de inicialización
  permanecen visibles. Un IFC sin geometría ya no se informa como carga exitosa.
- Se observa el tamaño del canvas y se encuadra el modelo según el campo de
  visión horizontal y vertical.
- Regresión manual: arrancar `pnpm dev`, esperar «Visor 3D listo» y seleccionar
  `packages/test-fixtures/minimal-wall.ifc`. Debe aparecer una pared completa y
  el estado `loaded with IFClite`, sin errores de compilación WASM en consola.
- Resultado: flujo anterior verificado visualmente en el navegador integrado
  con WebGPU y sin `SharedArrayBuffer`. El IFC del usuario debe seleccionarse de
  nuevo para validar su geometría particular. Archivos grandes y la ruta
  multiproceso siguen pendientes de validación funcional.

## Fase 3 — GIS sincronizado y Cesium

### Navegación del slice IFC — 2026-10-17

Antes de avanzar a GIS, se ha completado la navegación del renderer BIM:
rotación orbital, paneo, zoom y recuperación del encuadre. El enlace de eventos
del canvas está aislado en `packages/adapters-ifclite/src/navigation.ts` y usa
la cámara pública de IFClite. La UI ofrece modos Rotar/Panear y botones de zoom
y encuadre. Los atajos solo actúan cuando el canvas tiene el foco.

Criterios de aceptación de navegación:

- Un arrastre izquierdo cambia la orientación sin perder el centro de órbita.
- Botón derecho, central, Shift o modo Panear trasladan la vista.
- Rueda y botones +/− cambian la distancia al modelo.
- Encuadrar, F e Inicio recuperan la vista completa según el aspecto del canvas.
- Cancelar el gesto, perder captura/foco o desmontar la vista libera la captura.
- Los listeners se retiran al liberar el adaptador; el zoom no desplaza la página.

Verificación: siete pruebas de contrato de entrada con `pnpm test`, typecheck y
build. En el navegador integrado se ha comprobado visualmente la rotación,
el desplazamiento y el zoom del fixture `minimal-wall.ifc`.
Referencia: [API de cámara IFClite](https://ifclite.dev/docs/guide/quickstart/#3-add-camera-controls).

### Entrega GIS

Estado: siguiente.

1. Añadir adaptador OpenLayers con CRS y transformación reversible al marco local.
2. Añadir adaptador Cesium para globo, terreno, imagery y 3D Tiles sin mezclarlo
   con el renderer BIM.
3. Introducir un `SceneSelectionStore` común para selección, cámara y coordenadas.
4. Añadir pruebas de contrato para sincronización 2D/3D.

## Fase 4 — Nubes de puntos

Estado: planificada.

1. Importación local E57 y LAS/LAZ con workers y cancelación.
2. Lectura COPC publicada mediante rangos visibles y LOD adaptativo.
3. Registro explícito nube-IFC y representación del error de alineación.
4. Exportación de muestras proyectadas como capa DXF independiente.

## Fase 5 — Secciones, planos y DXF

Estado: planificada.

1. Crear cortes horizontales y secciones nombradas en el dominio.
2. Obtener linework 2D desde la API de drawings de IFClite.
3. Exportar DXF R12 ASCII en metros, con capas y metadatos CRS.
4. Validar la salida con fixtures geométricos y un parser DXF de prueba.

## Fase 6 — Persistencia, despliegue y hardening

Estado: planificada.

- OPFS/IndexedDB, reapertura de manifiestos y caché invalidable.
- GitHub Pages, fallback WebGL y comportamiento sin `SharedArrayBuffer`.
- accesibilidad, E2E, presupuesto de bundle, inventario de licencias y CI.
