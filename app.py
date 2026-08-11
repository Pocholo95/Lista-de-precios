import os
import secrets
from functools import wraps

from flask import Flask, render_template, request, jsonify, send_from_directory, session, send_file
from werkzeug.utils import secure_filename

from modules.image import ImageProcessor
from modules.db import ProductDatabase
from modules.backup import create_backup_zip

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB

UPLOAD_FOLDER = 'static/images'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
SECRET_KEY_FILE = '.secret_key'
ADMIN_PIN = os.environ.get('ADMIN_PIN', '1234')

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs('static', exist_ok=True)
os.makedirs('modules', exist_ok=True)


def _load_or_create_secret_key():
    if os.path.exists(SECRET_KEY_FILE):
        with open(SECRET_KEY_FILE, 'r') as f:
            return f.read().strip()
    key = secrets.token_hex(32)
    with open(SECRET_KEY_FILE, 'w') as f:
        f.write(key)
    return key


app.secret_key = _load_or_create_secret_key()

image_processor = ImageProcessor(UPLOAD_FOLDER)
db = ProductDatabase()

image_processor.create_placeholder()


def allowed_file(filename):
    return image_processor.validate_image_extension(filename, ALLOWED_EXTENSIONS)


def is_admin():
    return session.get('is_admin', False)


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not is_admin():
            return jsonify({'error': 'No autorizado'}), 401
        return fn(*args, **kwargs)
    return wrapper


# ─── RUTAS PRINCIPALES ───

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/sw.js')
def service_worker():
    # Se sirve desde la raíz (no /static/) para que su scope cubra todo el sitio,
    # incluyendo /api/... y la página principal.
    response = send_from_directory('static', 'sw.js')
    response.headers['Service-Worker-Allowed'] = '/'
    return response


# ─── ADMIN (PIN) ───

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.get_json(silent=True) or {}
    pin = str(data.get('pin', ''))
    if secrets.compare_digest(pin, ADMIN_PIN):
        session['is_admin'] = True
        session.permanent = True
        return jsonify({'ok': True})
    return jsonify({'error': 'PIN incorrecto'}), 401


@app.route('/api/admin/logout', methods=['POST'])
def admin_logout():
    session.pop('is_admin', None)
    return jsonify({'ok': True})


@app.route('/api/admin/status', methods=['GET'])
def admin_status():
    return jsonify({'is_admin': is_admin()})


@app.route('/api/admin/backup', methods=['GET'])
@admin_required
def admin_backup():
    buffer, filename = create_backup_zip(db_path=db.db_path, images_dir=UPLOAD_FOLDER)
    return send_file(buffer, mimetype='application/zip', as_attachment=True, download_name=filename)


# ─── PRODUCTOS ───

@app.route('/api/products', methods=['GET'])
def get_products():
    return jsonify(db.get_products(sort_by_date=True, only_visible=not is_admin()))


@app.route('/api/products/search', methods=['GET'])
def search_products():
    query       = request.args.get('q', '')
    category_id = request.args.get('category') or None
    return jsonify(db.search_products(query, category_id, only_visible=not is_admin()))


@app.route('/api/products', methods=['POST'])
@admin_required
def add_product():
    try:
        name        = request.form.get('name', '').strip()
        description = request.form.get('description', '').strip()
        price       = request.form.get('price', '0')
        categories  = request.form.getlist('categories')
        pres_qty    = request.form.get('presentation_qty', '').strip()
        pres_unit   = request.form.get('presentation_unit', '').strip()
        visible     = request.form.get('visible', '1') == '1'
        barcode     = request.form.get('barcode', '').strip()

        if not name:
            return jsonify({'error': 'El nombre es requerido'}), 400

        image_filename = 'placeholder.webp'
        if 'image' in request.files:
            file = request.files['image']
            if file and file.filename and allowed_file(file.filename):
                filename = f"{secrets.token_hex(8)}_{secure_filename(file.filename)}"
                filepath = os.path.join(UPLOAD_FOLDER, filename)
                file.save(filepath)
                image_filename = image_processor.process_image(filepath)

        product = db.add_product(
            name=name,
            description=description,
            price=float(price) if price else 0.0,
            image=image_filename,
            categories=categories,
            presentation_qty=pres_qty,
            presentation_unit=pres_unit,
            visible=visible,
            barcode=barcode
        )
        return jsonify(product), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/products/<product_id>', methods=['PUT'])
@admin_required
def update_product(product_id):
    try:
        existing = db.get_product_by_id(product_id)
        if not existing:
            return jsonify({'error': 'Producto no encontrado'}), 404

        name        = request.form.get('name', '').strip()
        description = request.form.get('description', '').strip()
        price       = request.form.get('price', '0')
        categories  = request.form.getlist('categories')
        pres_qty    = request.form.get('presentation_qty', '').strip()
        pres_unit   = request.form.get('presentation_unit', '').strip()
        visible     = request.form.get('visible', '1') == '1'
        barcode     = request.form.get('barcode', '').strip()

        if not name:
            return jsonify({'error': 'El nombre es requerido'}), 400

        image_filename = None
        if 'image' in request.files:
            file = request.files['image']
            if file and file.filename and allowed_file(file.filename):
                image_processor.delete_image(existing['image'])
                filename = f"{secrets.token_hex(8)}_{secure_filename(file.filename)}"
                filepath = os.path.join(UPLOAD_FOLDER, filename)
                file.save(filepath)
                image_filename = image_processor.process_image(filepath)

        updated = db.update_product(
            product_id=product_id,
            name=name,
            description=description,
            price=float(price) if price else 0.0,
            image=image_filename,
            categories=categories,
            presentation_qty=pres_qty,
            presentation_unit=pres_unit,
            visible=visible,
            barcode=barcode
        )

        if updated:
            return jsonify(updated)
        return jsonify({'error': 'Error al actualizar el producto'}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/products/<product_id>', methods=['DELETE'])
@admin_required
def delete_product(product_id):
    try:
        product = db.get_product_by_id(product_id)
        if not product:
            return jsonify({'error': 'Producto no encontrado'}), 404

        image_processor.delete_image(product['image'])
        db.delete_product(product_id)
        return jsonify({'message': 'Producto eliminado correctamente'})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/products/category/<category_id>', methods=['GET'])
def get_products_by_category(category_id):
    return jsonify(db.get_products_by_category(category_id, only_visible=not is_admin()))


@app.route('/api/products/barcode/<code>', methods=['GET'])
def get_product_by_barcode(code):
    product = db.get_product_by_barcode(code, only_visible=not is_admin())
    if not product:
        return jsonify({'error': 'Código no encontrado'}), 404
    return jsonify(product)


# ─── CATEGORÍAS ───

@app.route('/api/categories', methods=['GET'])
def get_categories():
    return jsonify(db.get_categories())


@app.route('/api/categories/stats', methods=['GET'])
def get_category_stats():
    return jsonify(db.get_category_stats())


@app.route('/api/categories', methods=['POST'])
@admin_required
def add_category():
    try:
        data        = request.get_json()
        name        = data.get('name', '').strip()
        description = data.get('description', '').strip()
        if not name:
            return jsonify({'error': 'El nombre es requerido'}), 400
        return jsonify(db.add_category(name=name, description=description)), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/categories/<category_id>', methods=['PUT'])
@admin_required
def update_category(category_id):
    try:
        data        = request.get_json()
        name        = data.get('name', '').strip()
        description = data.get('description', '').strip()
        if not name:
            return jsonify({'error': 'El nombre es requerido'}), 400
        updated = db.update_category(category_id=category_id, name=name, description=description)
        if updated:
            return jsonify(updated)
        return jsonify({'error': 'Categoría no encontrada'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/categories/<category_id>', methods=['DELETE'])
@admin_required
def delete_category(category_id):
    try:
        if db.delete_category(category_id):
            return jsonify({'message': 'Categoría eliminada correctamente'})
        return jsonify({'error': 'Categoría no encontrada'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── ESTÁTICOS ───

@app.route('/static/images/<filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


if __name__ == '__main__':
    print('─' * 40)
    print('🛒  Catálogo de productos')
    print('🌐  http://localhost:5000  (o http://<IP-de-esta-PC>:5000 desde el teléfono)')
    if ADMIN_PIN == '1234':
        print('⚠️   Usando PIN de admin por defecto (1234). Cámbialo con la variable de entorno ADMIN_PIN.')
    print('─' * 40)
    app.run(debug=True, host='0.0.0.0', port=5000)
