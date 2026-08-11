import sqlite3
import json
import uuid
import os
from datetime import datetime


DB_PATH = 'catalog.db'


class ProductDatabase:
    def __init__(self, db_path=DB_PATH):
        self.db_path = db_path
        self._init_db()
        self._migrate_from_json()

    def _conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute('PRAGMA foreign_keys = ON')
        conn.execute('PRAGMA journal_mode = WAL')  # mejor rendimiento concurrente
        return conn

    def _init_db(self):
        with self._conn() as conn:
            conn.executescript('''
                CREATE TABLE IF NOT EXISTS categories (
                    id          TEXT PRIMARY KEY,
                    name        TEXT NOT NULL,
                    description TEXT DEFAULT '',
                    created_at  TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS products (
                    id                  TEXT PRIMARY KEY,
                    name                TEXT NOT NULL,
                    description         TEXT DEFAULT '',
                    price               REAL DEFAULT 0.0,
                    image               TEXT DEFAULT 'placeholder.webp',
                    created_at          TEXT NOT NULL,
                    updated_at          TEXT,
                    presentation_qty    TEXT DEFAULT '',
                    presentation_unit   TEXT DEFAULT ''
                );

                CREATE TABLE IF NOT EXISTS product_categories (
                    product_id  TEXT NOT NULL,
                    category_id TEXT NOT NULL,
                    PRIMARY KEY (product_id, category_id),
                    FOREIGN KEY (product_id)  REFERENCES products(id)   ON DELETE CASCADE,
                    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
                );
            ''')

    def _migrate_from_json(self):
        """Importa datos de los JSON viejos si la BD está vacía."""
        # Migración de esquema: agregar columnas de presentación a BD existente
        with self._conn() as conn:
            for col, default in [('presentation_qty', ''), ('presentation_unit', '')]:
                try:
                    conn.execute(f"ALTER TABLE products ADD COLUMN {col} TEXT DEFAULT '{default}'")
                except Exception:
                    pass  # La columna ya existe, ignorar

        with self._conn() as conn:
            if conn.execute('SELECT COUNT(*) FROM products').fetchone()[0] > 0:
                return  # Ya tiene datos, no migrar

        # Buscar archivos JSON en varias rutas posibles
        cat_paths  = ['categories.json', 'data/categories.json']
        prod_paths = ['products.json',   'data/products.json']

        for path in cat_paths:
            if os.path.exists(path):
                try:
                    with open(path, encoding='utf-8') as f:
                        cats = json.load(f)
                    with self._conn() as conn:
                        for c in cats:
                            conn.execute(
                                'INSERT OR IGNORE INTO categories VALUES (?,?,?,?)',
                                (c['id'], c['name'], c.get('description', ''), c['created_at'])
                            )
                    print(f'✅ Migradas {len(cats)} categorías desde {path}')
                except Exception as e:
                    print(f'⚠️  No se pudieron migrar categorías: {e}')
                break

        for path in prod_paths:
            if os.path.exists(path):
                try:
                    with open(path, encoding='utf-8') as f:
                        prods = json.load(f)
                    with self._conn() as conn:
                        for p in prods:
                            conn.execute(
                                'INSERT OR IGNORE INTO products VALUES (?,?,?,?,?,?,?)',
                                (p['id'], p['name'], p.get('description', ''),
                                 p.get('price', 0.0), p.get('image', 'placeholder.webp'),
                                 p['created_at'], p.get('updated_at'))
                            )
                            for cat_id in p.get('categories', []):
                                conn.execute(
                                    'INSERT OR IGNORE INTO product_categories VALUES (?,?)',
                                    (p['id'], cat_id)
                                )
                    print(f'✅ Migrados {len(prods)} productos desde {path}')
                except Exception as e:
                    print(f'⚠️  No se pudieron migrar productos: {e}')
                break

    # ─────────────────── HELPERS ───────────────────

    def _with_categories(self, row, conn):
        if not row:
            return None
        d = dict(row)
        cats = conn.execute(
            'SELECT category_id FROM product_categories WHERE product_id = ?', (d['id'],)
        ).fetchall()
        d['categories'] = [c['category_id'] for c in cats]
        return d

    # ─────────────────── PRODUCTS ───────────────────

    def get_products(self, sort_by_date=True):
        order = 'ORDER BY created_at DESC' if sort_by_date else 'ORDER BY name'
        with self._conn() as conn:
            rows = conn.execute(f'SELECT * FROM products {order}').fetchall()
            return [self._with_categories(r, conn) for r in rows]

    def get_product_by_id(self, product_id):
        with self._conn() as conn:
            row = conn.execute('SELECT * FROM products WHERE id = ?', (product_id,)).fetchone()
            return self._with_categories(row, conn)

    def search_products(self, query, category_id=None):
        q = f'%{query}%'
        with self._conn() as conn:
            if category_id:
                rows = conn.execute('''
                    SELECT p.* FROM products p
                    JOIN product_categories pc ON p.id = pc.product_id
                    WHERE pc.category_id = ?
                      AND (p.name LIKE ? OR p.description LIKE ?)
                    ORDER BY p.created_at DESC
                ''', (category_id, q, q)).fetchall()
            else:
                rows = conn.execute(
                    'SELECT * FROM products WHERE name LIKE ? OR description LIKE ? ORDER BY created_at DESC',
                    (q, q)
                ).fetchall()
            return [self._with_categories(r, conn) for r in rows]

    def load_products(self):
        """Alias para compatibilidad."""
        return self.get_products()

    def add_product(self, name, description, price, image, categories,
                    presentation_qty='', presentation_unit=''):
        pid = str(uuid.uuid4())
        now = datetime.now().isoformat()
        with self._conn() as conn:
            conn.execute(
                'INSERT INTO products VALUES (?,?,?,?,?,?,?,?,?)',
                (pid, name, description, float(price), image, now, now,
                 presentation_qty, presentation_unit)
            )
            for cat_id in categories:
                conn.execute('INSERT OR IGNORE INTO product_categories VALUES (?,?)', (pid, cat_id))
        return self.get_product_by_id(pid)

    def update_product(self, product_id, name, description, price, image=None,
                       categories=None, presentation_qty='', presentation_unit=''):
        now = datetime.now().isoformat()
        with self._conn() as conn:
            if image:
                conn.execute(
                    'UPDATE products SET name=?,description=?,price=?,image=?,updated_at=?,'
                    'presentation_qty=?,presentation_unit=? WHERE id=?',
                    (name, description, float(price), image, now,
                     presentation_qty, presentation_unit, product_id)
                )
            else:
                conn.execute(
                    'UPDATE products SET name=?,description=?,price=?,updated_at=?,'
                    'presentation_qty=?,presentation_unit=? WHERE id=?',
                    (name, description, float(price), now,
                     presentation_qty, presentation_unit, product_id)
                )
            if categories is not None:
                conn.execute('DELETE FROM product_categories WHERE product_id = ?', (product_id,))
                for cat_id in categories:
                    conn.execute('INSERT OR IGNORE INTO product_categories VALUES (?,?)', (product_id, cat_id))
        return self.get_product_by_id(product_id)

    def delete_product(self, product_id):
        with self._conn() as conn:
            conn.execute('DELETE FROM product_categories WHERE product_id = ?', (product_id,))
            conn.execute('DELETE FROM products WHERE id = ?', (product_id,))
        return True

    def get_products_by_category(self, category_id):
        with self._conn() as conn:
            rows = conn.execute('''
                SELECT p.* FROM products p
                JOIN product_categories pc ON p.id = pc.product_id
                WHERE pc.category_id = ?
                ORDER BY p.created_at DESC
            ''', (category_id,)).fetchall()
            return [self._with_categories(r, conn) for r in rows]

    # ─────────────────── CATEGORIES ───────────────────

    def get_categories(self):
        with self._conn() as conn:
            rows = conn.execute('SELECT * FROM categories ORDER BY name').fetchall()
            return [dict(r) for r in rows]

    def get_category_stats(self):
        with self._conn() as conn:
            rows = conn.execute('''
                SELECT c.id, c.name, COUNT(pc.product_id) AS count
                FROM categories c
                LEFT JOIN product_categories pc ON c.id = pc.category_id
                GROUP BY c.id, c.name
                ORDER BY count DESC
            ''').fetchall()
            return [dict(r) for r in rows]

    def add_category(self, name, description=''):
        cid = str(uuid.uuid4())
        now = datetime.now().isoformat()
        with self._conn() as conn:
            conn.execute('INSERT INTO categories VALUES (?,?,?,?)', (cid, name, description, now))
        return {'id': cid, 'name': name, 'description': description, 'created_at': now}

    def update_category(self, category_id, name, description=''):
        with self._conn() as conn:
            r = conn.execute(
                'UPDATE categories SET name=?,description=? WHERE id=?',
                (name, description, category_id)
            )
            if r.rowcount == 0:
                return None
        return {'id': category_id, 'name': name, 'description': description}

    def delete_category(self, category_id):
        with self._conn() as conn:
            conn.execute('DELETE FROM product_categories WHERE category_id = ?', (category_id,))
            r = conn.execute('DELETE FROM categories WHERE id = ?', (category_id,))
            return r.rowcount > 0