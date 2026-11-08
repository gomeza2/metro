# Validación de CITYFLOW 0.22

## Reglas y compilación

91 pruebas de Node aprobadas, sin fallos ni omitidas. Pasaron TypeScript estricto, Vite y la comprobación de recursos/rutas/versión tanto en dist como en la publicación compilada de main/root. Permanecen las pruebas anteriores de rutas, transbordos, conservación de pasajeros, economía, certificación, crecimiento temporal y reinicio.

Las pruebas nuevas verifican:

- Inicio 3 estaciones/1 línea y aperturas exactas a los 30, 60 y 150 segundos; Gran Estadio disponible antes de su preparación.
- Tutorial derivado de acciones; rechazo de estaciones cerradas y ausencia de viajes hacia ellas.
- Capacidad/velocidad de cada política y estimaciones de ciclo e intervalo.
- Coste único de cambio, gratuidad antes del servicio, fondos insuficientes y presupuestos inválidos.
- Un tren conserva su política en tránsito, la adopta en una estación y no pierde pasajeros por bajar de capacidad.
- Embarque de 6/9/4 personas con servicio equilibrado/local/rápido.
- Precios, límites, alcance local y reinicio de andenes; la misma cola genera distinta presión según su capacidad.
- ½× avanza exactamente medio segundo en sesenta frames, conservando los pasos de simulación de 1/60.

## Navegador

Chromium del sistema con Playwright externo, sin dependencias nuevas del juego. Se probaron archivos estáticos reales bajo `/metro/` y `/main-root/`, además de la compilación.

La nueva suite de crecimiento pasó a 1440×1000, 390×844 y 320×568: interfaz española, tres estaciones iniciales seleccionables, líneas bloqueadas, tutorial completo por acciones reales, primer pasajero entregado, pausa, inspección, inversión de andén, vista previa y compra de política, teclado, nuevas estaciones/líneas y reinicio al presupuesto/mapa originales. En escritorio se recorrieron todas las etapas hasta 14 estaciones y 4 líneas. El menú mantuvo congelados reloj y pausa al pulsar Espacio. Las capturas se inspeccionaron y el Canvas se comprobó con datos de píxeles, no solo con un puerto abierto o un DOM presente.

La suite general pasó en escritorio, tablet, teléfono y horizontal: conexiones reales en Canvas, contratos, compras, flota, inspección, zoom/desplazamiento, DPR, retorno del menú y reinicio. No hubo excepciones de página ni desbordamiento horizontal en los casos seleccionados.

La certificación conservó victoria y derrota por plazo mediante partidas deterministas con controles reales y reloj virtual. El resultado detuvo la simulación y permitió reiniciar. La suite de entrada directa pasó en cuatro tamaños, con entrada/motor retrasados más de 20 segundos, recursos ausentes y reintento. No se reintrodujo una pantalla de carga.

## Límites

Las estimaciones de frecuencia son teóricas: no garantizan el espaciado real de la flota. Las nuevas políticas, precios y expansiones necesitan pruebas con jugadores para afinar equilibrio. No se afirmó validación en hardware táctil real, Safari/Firefox, lectores de pantalla o memoria de larga duración. Las comprobaciones locales y el push a GitHub no prueban la finalización del despliegue público; el acceso directo a Pages/API sigue limitado por la política de red del entorno.
