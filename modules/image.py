import os
import io
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont
from rembg import remove


class ImageProcessor:
    def __init__(self, upload_folder='static/images'):
        self.upload_folder = upload_folder
        os.makedirs(upload_folder, exist_ok=True)

    def process_image(self, image_path, remove_bg=True):
        """
        Procesar imagen: centrar, redimensionar y convertir a WebP.
        Si remove_bg=True también quita el fondo con rembg.
        """
        try:
            if remove_bg:
                # Remover fondo con rembg
                with open(image_path, 'rb') as f:
                    input_data = f.read()
                output_data = remove(input_data)
                img = Image.open(io.BytesIO(output_data)).convert('RGBA')

                # Recortar al contenido y centrar en canvas cuadrado
                img_array = np.array(img)
                alpha = img_array[:, :, 3]
                coords = np.column_stack(np.where(alpha > 0))

                if len(coords) > 0:
                    y_min, x_min = coords.min(axis=0)
                    y_max, x_max = coords.max(axis=0)
                    cropped = img_array[y_min:y_max+1, x_min:x_max+1]

                    size = max(cropped.shape[0], cropped.shape[1])
                    canvas_size = int(size * 1.2)
                    canvas = np.zeros((canvas_size, canvas_size, 4), dtype=np.uint8)

                    y_off = (canvas_size - cropped.shape[0]) // 2
                    x_off = (canvas_size - cropped.shape[1]) // 2
                    canvas[y_off:y_off+cropped.shape[0], x_off:x_off+cropped.shape[1]] = cropped

                    img = Image.fromarray(canvas, 'RGBA')
            else:
                # Sin quitar fondo: convertir a RGBA directamente
                img = Image.open(image_path).convert('RGBA')

            # Redimensionar a máximo 400x400 manteniendo proporción
            img.thumbnail((400, 400), Image.Resampling.LANCZOS)

            # Canvas final 400x400 centrado (transparente para imágenes sin fondo,
            # blanco para imágenes con fondo)
            if remove_bg:
                final = Image.new('RGBA', (400, 400), (0, 0, 0, 0))
            else:
                final = Image.new('RGBA', (400, 400), (255, 255, 255, 255))

            px = (400 - img.width)  // 2
            py = (400 - img.height) // 2
            final.paste(img, (px, py), img)

            # Guardar como WebP
            webp_path = image_path.rsplit('.', 1)[0] + '.webp'
            final.save(webp_path, 'WebP', quality=90, method=6)

            if not image_path.endswith('.webp'):
                os.remove(image_path)

            return os.path.basename(webp_path)

        except Exception as e:
            print(f'Error procesando imagen: {e}')
            # Fallback: convertir a WebP sin procesar
            try:
                img = Image.open(image_path).convert('RGBA')
                webp_path = image_path.rsplit('.', 1)[0] + '.webp'
                img.save(webp_path, 'WebP', quality=90)
                if not image_path.endswith('.webp'):
                    os.remove(image_path)
                return os.path.basename(webp_path)
            except:
                return 'placeholder.webp'

    def create_placeholder(self):
        """Crear imagen placeholder si no existe."""
        placeholder_path = os.path.join(self.upload_folder, 'placeholder.webp')
        if not os.path.exists(placeholder_path):
            img = Image.new('RGBA', (400, 400), (240, 240, 240, 255))
            try:
                draw = ImageDraw.Draw(img)
                try:
                    font = ImageFont.truetype('arial.ttf', 36)
                except:
                    font = ImageFont.load_default()
                text = 'Sin Imagen'
                bbox = draw.textbbox((0, 0), text, font=font)
                w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
                draw.text(((400-w)//2, (400-h)//2), text, fill=(128, 128, 128, 255), font=font)
            except:
                pass
            img.save(placeholder_path, 'WebP', quality=90)

    def delete_image(self, image_filename):
        """Eliminar imagen del sistema de archivos."""
        if image_filename and image_filename != 'placeholder.webp':
            path = os.path.join(self.upload_folder, image_filename)
            if os.path.exists(path):
                try:
                    os.remove(path)
                    return True
                except Exception as e:
                    print(f'Error eliminando imagen {image_filename}: {e}')
                    return False
        return True

    def validate_image_extension(self, filename, allowed_extensions=None):
        """Validar si el archivo tiene una extensión permitida."""
        if allowed_extensions is None:
            allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
        return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions
