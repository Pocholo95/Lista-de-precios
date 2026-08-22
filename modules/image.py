import io
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from rembg import remove, new_session

MAX_SIZE = 500

# u2netp es la versión liviana del modelo de rembg (~4.5MB vs ~176MB de u2net normal):
# bastante más rápida y ligera de correr en una laptop común, con menos precisión en
# casos difíciles pero de sobra para fotos de producto con fondo simple.
_session = None


def _get_session():
    global _session
    if _session is None:
        _session = new_session('u2netp')
    return _session


class ImageProcessor:
    def __init__(self, upload_folder='static/images'):
        self.upload_folder = upload_folder
        os.makedirs(upload_folder, exist_ok=True)

    def process_image(self, image_path, remove_bg=True):
        """Quita el fondo (IA liviana), recorta al contenido, centra en cuadrado y
        convierte a WebP. Si remove_bg=False, solo recorta al cuadrado y comprime."""
        try:
            if remove_bg:
                img = self._remove_background(image_path)
            else:
                img = Image.open(image_path).convert('RGB')
                img = self._crop_to_square(img)

            if max(img.size) > MAX_SIZE:
                img.thumbnail((MAX_SIZE, MAX_SIZE), Image.Resampling.LANCZOS)

            webp_path = image_path.rsplit('.', 1)[0] + '.webp'
            img.save(webp_path, 'WebP', quality=85, method=6)

            if not image_path.endswith('.webp'):
                os.remove(image_path)

            return os.path.basename(webp_path)

        except Exception as e:
            print(f'Error procesando imagen: {e}')
            return 'placeholder.webp'

    def _remove_background(self, image_path):
        with open(image_path, 'rb') as f:
            input_bytes = f.read()
        output_bytes = remove(input_bytes, session=_get_session())
        img = Image.open(io.BytesIO(output_bytes)).convert('RGBA')

        arr = np.array(img)
        alpha = arr[:, :, 3]
        coords = np.argwhere(alpha > 10)
        if coords.size == 0:
            return img

        y_min, x_min = coords.min(axis=0)
        y_max, x_max = coords.max(axis=0)
        cropped = arr[y_min:y_max + 1, x_min:x_max + 1]

        # Un poco de margen alrededor del producto para que no quede pegado al borde
        h, w = cropped.shape[:2]
        side = int(max(h, w) * 1.15)
        canvas = np.zeros((side, side, 4), dtype=np.uint8)
        y_off = (side - h) // 2
        x_off = (side - w) // 2
        canvas[y_off:y_off + h, x_off:x_off + w] = cropped

        return Image.fromarray(canvas, 'RGBA')

    def _crop_to_square(self, img):
        w, h = img.size
        side = min(w, h)
        left = (w - side) // 2
        top = (h - side) // 2
        return img.crop((left, top, left + side, top + side))

    def create_placeholder(self):
        """Crear imagen placeholder si no existe."""
        placeholder_path = os.path.join(self.upload_folder, 'placeholder.webp')
        if not os.path.exists(placeholder_path):
            img = Image.new('RGB', (400, 400), (240, 240, 240))
            try:
                draw = ImageDraw.Draw(img)
                try:
                    font = ImageFont.truetype('arial.ttf', 36)
                except Exception:
                    font = ImageFont.load_default()
                text = 'Sin Imagen'
                bbox = draw.textbbox((0, 0), text, font=font)
                w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
                draw.text(((400 - w) // 2, (400 - h) // 2), text, fill=(128, 128, 128), font=font)
            except Exception:
                pass
            img.save(placeholder_path, 'WebP', quality=90)

    def rotate_image(self, image_filename, degrees=-90):
        """Rota la imagen ya guardada (por defecto 90° en sentido horario) y la
        reescribe en el mismo archivo, sin cambiar su nombre."""
        if not image_filename or image_filename == 'placeholder.webp':
            return False
        path = os.path.join(self.upload_folder, image_filename)
        if not os.path.exists(path):
            return False
        try:
            img = Image.open(path)
            has_alpha = img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info)
            img = img.convert('RGBA') if has_alpha else img.convert('RGB')
            rotated = img.rotate(degrees, expand=True)
            rotated.save(path, 'WebP', quality=85, method=6)
            return True
        except Exception as e:
            print(f'Error rotando imagen {image_filename}: {e}')
            return False

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
        if allowed_extensions is None:
            allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
        return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions
