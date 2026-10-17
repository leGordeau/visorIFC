# visorIFC

Visor IFC de código abierto, ejecutado en el navegador, basado en IFClite.
El objetivo es integrar GIS con OpenLayers y Cesium, nubes de puntos y
exportación de planos y secciones a DXF, con despliegue estático en GitHub Pages.

## Estado

El frontend incluye el shell React y la integración inicial de IFClite con
parser columnar, geometría por lotes y renderer WebGPU. GIS, nubes de puntos,
DXF y persistencia avanzada están planificados; todavía no están implementados.
La integración compila, pero la validación funcional con modelos IFC sigue pendiente.

## Desarrollo

Requiere Node.js y pnpm 10.8.1.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm test
pnpm build
```

El servidor de desarrollo publica la aplicación en `http://localhost:5173`.
La vista IFC requiere un navegador con WebGPU.

## Navegación 3D

- Arrastre izquierdo: rotación alrededor del centro de la vista.
- Rueda: acercar o alejar.
- Arrastre derecho, central o Shift + izquierdo: paneo.
- Los botones **Rotar** y **Panear** eligen la función del arrastre izquierdo.
- **+**, **−** y **Encuadrar** permiten navegar desde la barra del visor.
- Con el canvas enfocado: flechas para rotar, Shift + flechas para panear,
  +/− para zoom y F o Inicio para recuperar el encuadre completo.

Las pruebas de entrada se ejecutan con `pnpm test` y requieren Node.js 22.6+
con soporte de eliminación de tipos TypeScript (verificadas con Node.js 24).

## Arquitectura y SDD

- [Especificación](docs/spec/ifc-gis-pointcloud-viewer.md)
- [Estado de las fases](docs/implementation-phases.md)
- [Lenguaje del dominio](CONTEXT.md)
- [Decisiones de arquitectura](docs/adr/)

`apps/viewer` contiene la aplicación. `packages` separa dominio, aplicación,
adaptadores IFClite/GIS/DXF/nubes de puntos, infraestructura del navegador y UI.

Este repositorio se ha extraído del trabajo frontend del commit `2fcf088`
de `leGordeau/point-cloud-master`, con un historial Git independiente.
El prototipo de Blender pertenece al proyecto original.
