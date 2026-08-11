# Catálogo de Productos SPA

Una aplicación web completa para gestionar un catálogo de productos con procesamiento automático de imágenes.

## Características

- ✅ **SPA (Single Page Application)** con Python Flask
- 🔍 **Búsqueda en tiempo real** de productos
- ➕ **Agregar productos** con formulario intuitivo
- ✏️ **Editar productos** existentes
- 🗑️ **Eliminar productos** con confirmación
- 📸 **Procesamiento automático de imágenes**:
  - Remoción de fondo con `rembg`
  - Centrado automático con `OpenCV`
  - Conversión a formato WebP
  - Redimensionamiento automático (400x400px)
- 🖼️ **Placeholder automático** para productos sin imagen
- 📱 **Diseño responsive** y moderno
- 💾 **Almacenamiento en JSON** para los datos
- 📂 **Organización automática** (más recientes primero)

## Requisitos del Sistema

- Python 3.8 o superior
- pip (gestor de paquetes de Python)

## Instalación

### 1. Instalar dependencias

```bash
pip install flask pillow opencv-python rembg numpy werkzeug onnxruntime
```

### 2. Estructura de archivos

Crea la siguiente estructura de carpetas:

```
proyecto/
│
├── app.py                 # Código del backend (Flask)
├── templates/
│   └── index.html        # Frontend (HTML/CSS/JS)
├── static/
│   └── images/           # Se crea automáticamente
├── products.json         # Se crea automáticamente
└── requirements.txt      # Lista de dependencias
```

### 3. Crear requirements.txt

```txt
Flask==2.3.3
Pillow==10.0.1
opencv-python==4.8.1.78
rembg==2.0.50
numpy==1.24.3
Werkzeug==2.3.7
```

### 4. Crear carpeta templates

```bash
mkdir templates
```

### 5. Guardar los archivos

- Guarda el **código Python** como `app.py`
- Guarda el **código HTML** como `templates/index.html`

## Ejecución

1. **Ejecutar la aplicación:**

```bash
python app.py
```

2. **Abrir en el navegador:**

```
http://localhost:5000
```

## Uso de la Aplicación

### Agregar Producto
1. Haz clic en "➕ Agregar Producto"
2. Completa el formulario:
   - **Nombre:** Requerido
   - **Descripción:** Opcional
   - **Precio:** Opcional
   - **Imagen:** Opcional (se procesará automáticamente)
3. Haz clic en "Guardar"

### Buscar Productos
- Escribe en el campo de búsqueda para filtrar por nombre o descripción
- La búsqueda es en tiempo real

### Editar Producto
1. Haz clic en "✏️ Editar" en la tarjeta del producto
2. Modifica los campos deseados
3. Haz clic en "Guardar"

### Eliminar Producto
1. Haz clic en "🗑️ Eliminar" en la tarjeta del producto
2. Confirma la eliminación

## Procesamiento de Imágenes

El sistema procesa automáticamente las imágenes subidas:

1. **Remoción de fondo** usando IA (rembg)
2. **Centrado automático** de la imagen
3. **Redimensionamiento** a 400x400 píxeles
4. **Conversión a WebP** para optimizar el tamaño
5. **Conservación de transparencia**

## Estructura de Datos

Los productos se guardan en `products.json` con la siguiente estructura:

```json
[
  {
    "id": "uuid-generado",
    "name": "Nombre del producto",
    "description": "Descripción del producto",
    "price": 99.99,
    "image": "imagen.webp",
    "created_at": "2024-01-01T12:00:00",
    "updated_at": "2024-01-01T12:00:00"
  }
]
```

## Características Técnicas

### Backend (Flask)
- **API RESTful** para gestión de productos
- **Procesamiento de imágenes** con OpenCV y rembg
- **Validación de archivos** y tipos permitidos
- **Manejo de errores** robusto
- **Almacenamiento en JSON** persistente

### Frontend (SPA)
- **Interfaz moderna** con CSS Grid y Flexbox
- **Interactividad** con JavaScript vanilla
- **Responsive design** para móviles y desktop
- **Notificaciones** de estado
- **Búsqueda en tiempo real** con debounce
- **Modales** para formularios

### Optimizaciones
- **Lazy loading** de imágenes
- **Compresión WebP** para menor tamaño
- **Debounce** en búsqueda para mejor rendimiento
- **Animaciones CSS** para mejor UX

## Solución de Problemas

### Error de instalación de rembg
Si tienes problemas instalando `rembg`, prueba:

```bash
pip install --upgrade pip
pip install rembg[new]
```

### Error de OpenCV
Si OpenCV no funciona, instala la versión headless:

```bash
pip uninstall opencv-python
pip install opencv-python-headless
```

### Puerto ocupado
Si el puerto 5000 está ocupado, modifica en `app.py`:

```python
app.run(debug=True, host='0.0.0.0', port=5001)  # Cambia el puerto
```

## Personalización

### Cambiar tamaño de imágenes
Modifica en `app.py` la función `process_image()`:

```python
# Cambiar 400x400 por el tamaño deseado
final_img.thumbnail((600, 600), Image.Resampling.LANCZOS)
final_canvas = Image.new('RGBA', (600, 600), (0, 0, 0, 0))
```

### Modificar colores
Edita las variables CSS en `templates/index.html`:

```css
:root {
  --primary-color: #3498db;
  --success-color: #27ae60;
  --danger-color: #e74c3c;
}
```

## Licencia

Este proyecto está bajo licencia MIT. Puedes usarlo libremente para proyectos personales o comerciales.
