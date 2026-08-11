from flask import Flask, render_template, request, jsonify, send_from_directory
import os
from werkzeug.utils import secure_filename

from modules.image import ImageProcessor
from modules.database import ProductDatabase

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB

UPLOAD_FOLDER = 'static/images'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs('static', exist_ok=True)
os.makedirs('modules', exist_ok=True)

image_processor = ImageProcessor(UPLOAD_FOLDER)
db = ProductDatabase()

image_processor.create_placeholder()


def allowed_file(filename):
    return image_processor.validate_image_extension(filename, ALLOWED_EXTENSIONS)


# ─── RUTAS PRINCIPALES ───

@app.route('/')
def index():
    return render_template('index.html')


# ─── PRODUCTOS ───

@app.route('/api/products', methods=['GET'])
def get_products():
    return jsonify(db.get_products(sort_by_date=True))


@app.route('/api/products/search', methods=['GET'])
def search_products():
    query       = request.args.get('q', '')
    category_id = request.args.get('category') or None
    return jsonify(db.search_products(query, category_id))


@app.route('/api/products', methods=['POST'])
def add_product():
    try:
        name        = request.form.get('name', '').strip()
        description = request.form.get('description', '').strip()
        price       = request.form.get('price', '0')
        categories  = request.form.getlist('categories')
        pres_qty    = request.form.get('presentation_qty', '').strip()
        pres_unit   = request.form.get('presentation_unit', '').strip()

        if not name:
            return jsonify({'error': 'El nombre es requerido'}), 400

        image_filename = 'placeholder.webp'
        if 'image' in request.files:
            file = request.files['image']
            if file and file.filename and allowed_file(file.filename):
                remove_bg = request.form.get('remove_bg', '1') == '1'
                filename = f"{len(db.load_products()) + 1}_{secure_filename(file.filename)}"
                filepath = os.path.join(UPLOAD_FOLDER, filename)
                file.save(filepath)
                image_filename = image_processor.process_image(filepath, remove_bg=remove_bg)

        product = db.add_product(
            name=name,
            description=description,
            price=float(price) if price else 0.0,
            image=image_filename,
            categories=categories,
            presentation_qty=pres_qty,
            presentation_unit=pres_unit
        )
        return jsonify(product), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/products/<product_id>', methods=['PUT'])
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

        if not name:
            return jsonify({'error': 'El nombre es requerido'}), 400

        image_filename = None
        if 'image' in request.files:
            file = request.files['image']
            if file and file.filename and allowed_file(file.filename):
                remove_bg = request.form.get('remove_bg', '1') == '1'
                image_processor.delete_image(existing['image'])
                filename = f"{product_id}_{secure_filename(file.filename)}"
                filepath = os.path.join(UPLOAD_FOLDER, filename)
                file.save(filepath)
                image_filename = image_processor.process_image(filepath, remove_bg=remove_bg)

        updated = db.update_product(
            product_id=product_id,
            name=name,
            description=description,
            price=float(price) if price else 0.0,
            image=image_filename,
            categories=categories,
            presentation_qty=pres_qty,
            presentation_unit=pres_unit
        )

        if updated:
            return jsonify(updated)
        return jsonify({'error': 'Error al actualizar el producto'}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/products/<product_id>', methods=['DELETE'])
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
    return jsonify(db.get_products_by_category(category_id))


# ─── CATEGORÍAS ───

@app.route('/api/categories', methods=['GET'])
def get_categories():
    return jsonify(db.get_categories())


@app.route('/api/categories/stats', methods=['GET'])
def get_category_stats():
    return jsonify(db.get_category_stats())


@app.route('/api/categories', methods=['POST'])
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
    print('🌐  http://localhost:5000')
    print('─' * 40)
    app.run(debug=True, host='0.0.0.0', port=5000)