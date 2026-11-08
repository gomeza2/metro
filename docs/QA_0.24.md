# Validación de CITYFLOW 0.24

## Motor y compilación

102 pruebas de Node aprobadas, sin fallos ni omitidas. TypeScript estricto, Vite y comprobación de recursos relativos, versión y sincronización de main/root aprobados mediante `npm run publish:root`. Se mantiene la publicación por Actions desde dist.

Cinco pruebas nuevas cubren: reasignación del tren menos ocupado, coste único, conservación de personas e identidades/posiciones de otros trenes; rechazo atómico de operaciones inválidas y fondos no finitos; recuperación de reserva y política de destino; un minuto de simulación con tres traslados sucesivos comprobando cada tick conservación de pasajeros y flota; lectura real de políticas mixtas, colas, destinos desconectados y prioridad por presión sin mutar estaciones. Las 97 pruebas anteriores permanecen aprobadas.

## Navegador

Chromium del sistema y Playwright externo, sin dependencias nuevas del juego. `scripts/fleet-smoke.mjs` pasó sobre main/root servido como archivos estáticos en 1440×1000, 390×844 y 320×568. Usa controles reales para construir dos líneas y comprar un refuerzo, trasladarlo por $4, comprobar pausa/carga, impedir acciones durante un borrador, recuperar una reserva de una ruta vaciada, inspeccionar la estación prioritaria y reiniciar. La previsualización de política/ruta conserva las cifras de la flota real. Se comprueba foco y apertura de la pestaña de estación en móvil. No hubo excepciones de página ni desbordamiento horizontal en estos casos.

La suite general pasó en escritorio, tablet, móvil y horizontal sobre main/root: conexiones Canvas, contratos, economía, compras, zoom/desplazamiento, DPR y reinicio. También pasaron en tres tamaños las suites de crecimiento/tutorial y de borradores/incidencias/historial.

Sobre dist bajo /metro/, pasó la suite de entrada en cuatro tamaños y las recuperaciones de recursos ausentes o entrada/motor retrasados más de veinte segundos. No hay pantalla de carga bloqueante ni límite de veinte segundos.

Se inspeccionaron capturas del nuevo panel en móvil y escritorio. Para repetir la suite, iniciar un servidor estático y usar `PLAYWRIGHT_MODULE` para seleccionar la instalación externa:

```bash
node scripts/fleet-smoke.mjs http://127.0.0.1:4174/main-root/
```

## Límites

Las pruebas usan reloj virtual y demanda determinista; no establecen equilibrio con jugadores ni rendimiento en hardware táctil real. Reasignar implica devolver pasajeros del tren retirado a su última estación, según la regla explicada en interfaz; no supone un viaje físico de ese tren entre líneas. Los precios por línea y el coste de traslado requieren pruebas de equilibrio. Las colas compartidas no se atribuyen exclusivamente a un servicio y las estimaciones no garantizan frecuencia real.

No se han probado Safari/Firefox, lectores de pantalla ni memoria durante sesiones prolongadas. Un servidor local con los archivos de producción y un push confirmado no prueban que el despliegue público haya terminado. El entorno mantiene restringido el acceso directo a Pages/API; no se afirma una comprobación visual del sitio público.
