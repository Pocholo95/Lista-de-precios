import os
from PIL import Image, ImageDraw, ImageFont

MAX_SIZE = 500


class ImageProcessor:
    def __init__(self, upload_folder='static/images'):
        self.upload_folder = upload_folder
        os.makedirs(upload_folder, exist_ok=True)

    def process_image(self, image_path):
        """Recorta al cuadrado centrado, redimensiona y convierte a WebP. Sin IA: rápido y liviano."""
        try:
            img = Image.open(image_path)
            img = img.convert('RGB')

            w, h = img.size
            side = min(w, h)
            left = (w - side) // 2
            top = (h - side) // 2
            img = img.crop((left, top, left + side, top + side))

            if side > MAX_SIZE:
                img = img.resize((MAX_SIZE, MAX_SIZE), Image.Resampling.LANCZOS)

            webp_path = image_path.rsplit('.', 1)[0] + '.webp'
            img.save(webp_path, 'WebP', quality=85, method=6)

            if not image_path.endswith('.webp'):
                os.remove(image_path)

            return os.path.basename(webp_path)

        except Exception as e:
            print(f'Error procesando imagen: {e}')
            return 'placeholder.webp'

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
