# Mi Catálogo

Catálogo de productos y precios, pensado para usarse desde el teléfono.

## Cómo arrancarlo

```bash
pip install -r requirements.txt
python app.py
```

Se abre en `http://localhost:5000`. Para entrar desde el teléfono, conéctalo a la misma
red WiFi que la PC donde corre el servidor y visita `http://<IP-de-esta-PC>:5000`
(la IP aparece en la consola al arrancar).

## Instalarlo como app en el teléfono

Abre la dirección en el navegador del teléfono y usa "Agregar a pantalla de inicio"
(Chrome/Safari). Queda con ícono propio y se abre sin la barra del navegador.

## Modo administrador

Por default el PIN es `1234`. **Cámbialo** antes de usarlo en serio, arrancando así:

```bash
set ADMIN_PIN=tu_pin_aqui
python app.py
```

(en PowerShell: `$env:ADMIN_PIN = "tu_pin_aqui"`)

Con el candado 🔒 arriba a la derecha entras a modo admin: agregar/editar/eliminar
productos y categorías, ocultar productos de la vista de clientes, y descargar respaldos.

## Respaldo

En modo admin, botón "💾 Respaldo": descarga un `.zip` con la base de datos y todas
las fotos. Se puede abrir con cualquier programa de zip; adentro va un `catalog_FECHA.db`
que se puede restaurar copiándolo sobre `catalog.db` si algo llegara a pasar.

## Notas técnicas

- Base de datos: SQLite con `journal_mode=WAL` y `synchronous=FULL` — protegida contra
  pérdida de datos si se va la luz a medio guardar.
- El respaldo usa la Online Backup API de SQLite (no una copia cruda del archivo), así
  que siempre genera un `.db` consistente aunque haya escrituras en curso.
- Fotos: se quita el fondo automáticamente con `rembg` usando el modelo liviano
  `u2netp` (~4.5MB, se descarga solo la primera vez que se sube una foto — necesita
  internet esa primera vez). Sin `opencv`, así que la instalación es mucho más
  liviana que el prototipo original. Cada foto tarda unos 2-4 segundos en procesarse.
