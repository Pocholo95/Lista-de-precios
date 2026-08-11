import sqlite3
import io
import os
import tempfile
import zipfile
from datetime import datetime


def create_backup_zip(db_path='catalog.db', images_dir='static/images'):
    """
    Genera un respaldo consistente: usa la Online Backup API de SQLite (segura aunque
    haya escrituras concurrentes en modo WAL, a diferencia de copiar el archivo crudo)
    y empaqueta la BD + las imágenes en un .zip listo para descargar.
    """
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    fd, tmp_db_path = tempfile.mkstemp(suffix='.db')
    os.close(fd)
    try:
        src = sqlite3.connect(db_path)
        dst = sqlite3.connect(tmp_db_path)
        with dst:
            src.backup(dst)
        src.close()
        dst.close()

        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            zf.write(tmp_db_path, arcname=f'catalog_{timestamp}.db')

            if os.path.isdir(images_dir):
                for filename in os.listdir(images_dir):
                    filepath = os.path.join(images_dir, filename)
                    if os.path.isfile(filepath):
                        zf.write(filepath, arcname=f'images/{filename}')

        buffer.seek(0)
        return buffer, f'respaldo_catalogo_{timestamp}.zip'
    finally:
        os.remove(tmp_db_path)
