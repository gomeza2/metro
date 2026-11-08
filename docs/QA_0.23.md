# Validación de CITYFLOW 0.23

## Motor y publicación

97 pruebas de Node aprobadas, sin fallos ni omitidas. TypeScript estricto, Vite y verificaciones de recursos relativos/versión aprobados mediante `npm run publish:root`. La raíz compilada coincide con dist y conserva el soporte de GitHub Pages main/root y Actions.

Las seis pruebas nuevas cubren independencia del borrador, rechazo de estaciones inválidas, impacto sin mutar pasajeros, reemplazo atómico/no-op/invalidación, conservación de pasajeros, fronteras y anuncios de incidencias, ralentización de un tramo afectado frente a uno normal, validación del historial y límite de ocho resultados. Las pruebas previas siguen cubriendo economía, transbordos, fases, crecimiento, políticas, andenes, certificación y reinicio.

## Navegador

Chromium del sistema mediante Playwright externo, sin nuevas dependencias del juego. La suite nueva `scripts/planning-smoke.mjs` pasó sobre la publicación estática real de main/root en 1440×1000, 390×844 y 320×568. Verificó edición/limpieza exclusivamente en borrador, tiempo detenido, Escape sin alterar la ruta real, menú sin reanudar un borrador, aplicación única, continuidad en pausa, aviso anticipado, incidencia activa y fin, pausa móvil, historial tras recargar y restauración de preferencias al salir de Hora pico. No hubo excepciones de página ni desbordamiento horizontal en estos casos. Se inspeccionaron capturas de escritorio y teléfono del borrador y del incidente.

La suite general sobre main/root pasó en escritorio, tablet, móvil y horizontal: recursos, conexiones mediante Canvas, contratos, economía, compras, zoom/desplazamiento, DPR y reinicio. La suite de entrada sobre dist bajo /metro/ pasó en cuatro tamaños, con recursos ausentes/reintento y entrada o motor retrasados más de 20 segundos: el menú permanece visible y los controles recuperan disponibilidad automáticamente. No se reintrodujo una pantalla de carga.

También pasaron las suites existentes de crecimiento y certificación durante la integración de esta versión, antes del último ajuste de aviso/pausa móvil. La certificación conservó victoria y vencimiento de plazo; las reglas del desafío no cambiaron en ese ajuste.

Para repetir la suite nueva, ejecutar con un servidor estático y `PLAYWRIGHT_MODULE` apuntando a la instalación externa:

```bash
node scripts/planning-smoke.mjs http://127.0.0.1:4173/main-root/
```

## Alcance

Los escenarios automatizados usan reloj virtual y demanda controlada; no prueban el equilibrio con jugadores. La nueva suite limita el dibujo a 20 Hz para avanzar el reloj de pruebas; los pasos del motor siguen siendo de 1/60. No se validaron hardware táctil real, Safari/Firefox, lectores de pantalla ni consumo prolongado de memoria. El historial guarda resúmenes, no partidas reanudables. Las estimaciones de conectividad y frecuencia no garantizan una red eficaz bajo demanda real.

El servidor local sirve archivos de producción, pero esto no confirma el despliegue público. El acceso directo a Pages/API está limitado por la política de red del entorno; un push confirmado a GitHub se informa por separado de la publicación.
