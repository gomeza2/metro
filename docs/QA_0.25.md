# Validación de CITYFLOW 0.25

## Simulación y publicación

108 pruebas de Node aprobadas, sin fallos ni omitidas. TypeScript estricto, Vite y verificaciones de recursos relativos/versión aprobados mediante `npm run publish:root`. Se sincronizaron los archivos compilados de main/root; el mismo build sigue publicable desde dist con Actions.

Las seis pruebas nuevas cubren presupuesto por etapa, compra y reinicio; presupuestos inválidos sin mutación; coste por geometría y por línea, recuperación al acortar; límite de seis paradas y compatibilidad Infinity; rechazo de ediciones antes de cambiar flota, pasajeros o planificador; historial con vía limitada y lectura de registros anteriores. Las 102 pruebas previas permanecen aprobadas.

## Navegador y resultado visual

Chromium del sistema con Playwright externo, sin añadir dependencias de producción. Las pruebas usan archivos estáticos reales de main/root y dist bajo /metro/.

`workspace-smoke.mjs` pasó en 1440×900, 390×844, 320×568 y 844×390, con DPR 2. Comprueba que el documento de juego no desborda vertical ni horizontalmente, que el mapa y el dock están dentro del viewport y que la gestión está cerrada al comenzar. Con clics reales en Canvas crea Barrio Norte–Museo, entrega al primer pasajero, muestra el objetivo y abre inspección en pausa. Construye hasta seis paradas, rechaza la séptima, rechaza falta de vía, compra material y vuelve a intentar. Comprueba límites del borrador sin alterar la ruta real, compras sin fondos, reinicio, backing store, resize y presencia de dibujo tras redimensionar. Se inspeccionaron capturas de escritorio, móvil, pantalla pequeña y horizontal del inicio y la gestión.

La suite general pasó en escritorio, tablet, móvil y horizontal: entrada compilada, ausencia de errores de recursos, conexiones reales, contratos, compras, flota, zoom/desplazamiento, DPR y reinicio. Los controles de gestión se abren mediante las pestañas visibles del nuevo panel.

La suite de crecimiento pasó en escritorio, móvil y pantalla pequeña: tutorial completo, inversión, políticas, atajos, etapas y reinicio. Las suites de flota y de planificación pasaron en los tres tamaños: traslados, recuperación de reserva, telemetría, foco de inspección, borradores aislados, aplicación/descarte, pausa al volver del menú, anuncio/fin de incidencias e historial. La certificación conservó victoria y vencimiento del plazo, informe detenido y reinicio. Libre y certificación indican vía libre.

La suite de entrada pasó sobre dist en cuatro tamaños, además de entrada/motor retrasados más de veinte segundos y recursos ausentes con reintento. El menú permanece disponible sin pantalla de carga y los módulos tardíos se recuperan automáticamente.

Las suites usan controles reales, reloj virtual y demanda determinista cuando corresponde; la simulación mantiene sus pasos de 1/60. Los scripts se adaptaron a la pausa al abrir gestión y usan `control-room.mjs` para seleccionar paneles. Para repetir la suite nueva, ejecutar primero npm test, iniciar un servidor estático y seleccionar Playwright mediante PLAYWRIGHT_MODULE:

```bash
node scripts/workspace-smoke.mjs http://127.0.0.1:4175/main-root/
```

## Límites

Estas comprobaciones prueban reglas, accesibilidad de controles y composición en los tamaños elegidos. No demuestran diversión ni equilibrio con jugadores, ni rendimiento de sesiones prolongadas. La nueva reserva de vía, los precios y el ritmo de fases necesitan pruebas de juego humanas. No se probaron hardware táctil real, Safari/Firefox ni lectores de pantalla. La ciudad sigue siendo Port Azure y no se presenta como mapa realista nuevo.

La consulta a la web oficial de Mini Motorways fue bloqueada por el proxy con 403. Tampoco se afirma comprobación visual del sitio público de CITYFLOW: el entorno restringe Pages/API. La validación local y el push de GitHub se informan por separado del despliegue público.
