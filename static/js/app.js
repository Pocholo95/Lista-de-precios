(() => {
    'use strict';

    const searchInput = document.getElementById('search-input');
    const chipsEl = document.getElementById('category-chips');
    const gridEl = document.getElementById('product-grid');
    const emptyEl = document.getElementById('empty-state');
    const loadingEl = document.getElementById('loading-state');

    const adminToggleBtn = document.getElementById('admin-toggle-btn');
    const adminBar = document.getElementById('admin-bar');
    const backupBtn = document.getElementById('backup-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const addFab = document.getElementById('add-fab');

    const pinModal = document.getElementById('pin-modal');
    const pinForm = document.getElementById('pin-form');
    const pinInput = document.getElementById('pin-input');
    const pinError = document.getElementById('pin-error');

    const productModal = document.getElementById('product-modal');
    const productForm = document.getElementById('product-form');
    const productModalTitle = document.getElementById('product-modal-title');
    const categoryCheckboxesEl = document.getElementById('category-checkboxes');
    const deleteBtn = document.getElementById('delete-btn');

    const categoriesBtn = document.getElementById('categories-btn');
    const categoriesModal = document.getElementById('categories-modal');
    const categoryAddForm = document.getElementById('category-add-form');
    const newCategoryNameInput = document.getElementById('new-category-name');
    const categoryListEl = document.getElementById('category-list');

    const state = {
        query: '',
        categoryId: null,
        categories: [],
        isAdmin: false,
    };

    const priceFormatter = new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2,
    });

    function debounce(fn, delay) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    }

    async function fetchJSON(url, options) {
        const res = await fetch(url, options);
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `Error ${res.status}`);
        }
        return res.json();
    }

    function openModal(modal) {
        modal.hidden = false;
    }

    function closeModal(modal) {
        modal.hidden = true;
    }

    const modalsByKey = {
        pin: pinModal,
        product: productModal,
        categories: categoriesModal,
    };

    document.querySelectorAll('[data-close]').forEach((el) => {
        el.addEventListener('click', () => {
            closeModal(modalsByKey[el.dataset.close]);
        });
    });

    // ─────────────────── CATEGORY CHIPS ───────────────────

    function renderChips() {
        const all = [{ id: null, name: 'Todas' }, ...state.categories];
        chipsEl.innerHTML = '';
        for (const cat of all) {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'chip' + (state.categoryId === cat.id ? ' chip--active' : '');
            chip.textContent = cat.name;
            chip.addEventListener('click', () => {
                state.categoryId = cat.id;
                renderChips();
                loadProducts();
            });
            chipsEl.appendChild(chip);
        }
    }

    function renderCategoryCheckboxes(selectedIds) {
        categoryCheckboxesEl.innerHTML = '';
        for (const cat of state.categories) {
            const label = document.createElement('label');
            label.className = 'category-checkbox';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.value = cat.id;
            input.checked = selectedIds.includes(cat.id);
            label.appendChild(input);
            label.appendChild(document.createTextNode(cat.name));
            categoryCheckboxesEl.appendChild(label);
        }
    }

    // ─────────────────── CATEGORY MANAGEMENT (admin) ───────────────────

    async function reloadCategories() {
        state.categories = await fetchJSON('/api/categories');
        renderChips();
    }

    function renderCategoryList() {
        categoryListEl.innerHTML = '';
        for (const cat of state.categories) {
            const li = document.createElement('li');
            li.className = 'category-list__item';

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = cat.name;
            nameInput.className = 'category-list__input';

            const saveBtn = document.createElement('button');
            saveBtn.type = 'button';
            saveBtn.className = 'category-list__icon-btn';
            saveBtn.textContent = '💾';
            saveBtn.title = 'Guardar nombre';
            saveBtn.addEventListener('click', async () => {
                const newName = nameInput.value.trim();
                if (!newName || newName === cat.name) return;
                try {
                    await fetchJSON(`/api/categories/${cat.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: newName, description: cat.description || '' }),
                    });
                    await reloadCategories();
                    renderCategoryList();
                    await loadProducts();
                } catch (err) {
                    alert(err.message || 'No se pudo renombrar la categoría');
                }
            });

            const deleteCatBtn = document.createElement('button');
            deleteCatBtn.type = 'button';
            deleteCatBtn.className = 'category-list__icon-btn';
            deleteCatBtn.textContent = '🗑️';
            deleteCatBtn.title = 'Eliminar categoría';
            deleteCatBtn.addEventListener('click', async () => {
                if (!confirm(`¿Eliminar la categoría "${cat.name}"? Los productos no se borran, solo pierden esta categoría.`)) return;
                try {
                    await fetchJSON(`/api/categories/${cat.id}`, { method: 'DELETE' });
                    await reloadCategories();
                    renderCategoryList();
                    await loadProducts();
                } catch (err) {
                    alert(err.message || 'No se pudo eliminar la categoría');
                }
            });

            li.appendChild(nameInput);
            li.appendChild(saveBtn);
            li.appendChild(deleteCatBtn);
            categoryListEl.appendChild(li);
        }
    }

    categoriesBtn.addEventListener('click', () => {
        renderCategoryList();
        openModal(categoriesModal);
    });

    categoryAddForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = newCategoryNameInput.value.trim();
        if (!name) return;
        try {
            await fetchJSON('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description: '' }),
            });
            newCategoryNameInput.value = '';
            await reloadCategories();
            renderCategoryList();
        } catch (err) {
            alert(err.message || 'No se pudo agregar la categoría');
        }
    });

    // ─────────────────── PRODUCT LIST ───────────────────

    function productCard(product) {
        const card = document.createElement('article');
        card.className = 'card' + (state.isAdmin && !product.visible ? ' card--hidden-product' : '');
        if (state.isAdmin) {
            card.addEventListener('click', () => openProductForm(product));
        }

        const img = document.createElement('img');
        img.className = 'card__img';
        img.loading = 'lazy';
        img.src = `/static/images/${product.image}`;
        img.alt = product.name;
        card.appendChild(img);

        const body = document.createElement('div');
        body.className = 'card__body';

        const name = document.createElement('div');
        name.className = 'card__name';
        name.textContent = product.name;
        body.appendChild(name);

        if (product.presentation_qty || product.presentation_unit) {
            const meta = document.createElement('div');
            meta.className = 'card__meta';
            meta.textContent = `${product.presentation_qty} ${product.presentation_unit}`.trim();
            body.appendChild(meta);
        }

        if (state.isAdmin && !product.visible) {
            const badge = document.createElement('div');
            badge.className = 'card__hidden-badge';
            badge.textContent = 'Oculto para clientes';
            body.appendChild(badge);
        }

        card.appendChild(body);

        const price = document.createElement('div');
        price.className = 'card__price';
        price.textContent = priceFormatter.format(product.price || 0);
        card.appendChild(price);

        return card;
    }

    function renderProducts(products) {
        gridEl.innerHTML = '';
        emptyEl.hidden = products.length > 0;
        for (const product of products) {
            gridEl.appendChild(productCard(product));
        }
    }

    async function loadProducts() {
        loadingEl.hidden = false;
        try {
            let url;
            if (state.query || state.categoryId) {
                const params = new URLSearchParams();
                params.set('q', state.query);
                if (state.categoryId) params.set('category', state.categoryId);
                url = `/api/products/search?${params.toString()}`;
            } else {
                url = '/api/products';
            }
            const products = await fetchJSON(url);
            renderProducts(products);
        } catch (err) {
            console.error(err);
            emptyEl.textContent = 'No se pudo cargar el catálogo. Intenta de nuevo.';
            emptyEl.hidden = false;
        } finally {
            loadingEl.hidden = true;
        }
    }

    // ─────────────────── ADMIN MODE ───────────────────

    function applyAdminUI() {
        document.body.classList.toggle('is-admin', state.isAdmin);
        adminBar.hidden = !state.isAdmin;
        addFab.hidden = !state.isAdmin;
        adminToggleBtn.textContent = state.isAdmin ? '🔓' : '🔒';
    }

    async function refreshAdminStatus() {
        try {
            const status = await fetchJSON('/api/admin/status');
            state.isAdmin = !!status.is_admin;
        } catch (err) {
            state.isAdmin = false;
        }
        applyAdminUI();
    }

    adminToggleBtn.addEventListener('click', () => {
        if (state.isAdmin) {
            applyAdminUI();
        } else {
            pinInput.value = '';
            pinError.hidden = true;
            openModal(pinModal);
            pinInput.focus();
        }
    });

    pinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await fetchJSON('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: pinInput.value }),
            });
            state.isAdmin = true;
            applyAdminUI();
            closeModal(pinModal);
            await loadProducts();
        } catch (err) {
            pinError.hidden = false;
        }
    });

    logoutBtn.addEventListener('click', async () => {
        await fetchJSON('/api/admin/logout', { method: 'POST' });
        state.isAdmin = false;
        applyAdminUI();
        await loadProducts();
    });

    backupBtn.addEventListener('click', () => {
        window.location.href = '/api/admin/backup';
    });

    // ─────────────────── PRODUCT FORM ───────────────────

    function resetProductForm() {
        productForm.reset();
        document.getElementById('product-id').value = '';
        document.getElementById('field-visible').checked = true;
        deleteBtn.hidden = true;
        renderCategoryCheckboxes([]);
    }

    function openProductForm(product) {
        resetProductForm();
        if (product) {
            productModalTitle.textContent = 'Editar producto';
            document.getElementById('product-id').value = product.id;
            document.getElementById('field-name').value = product.name;
            document.getElementById('field-price').value = product.price;
            document.getElementById('field-qty').value = product.presentation_qty || '';
            document.getElementById('field-unit').value = product.presentation_unit || '';
            document.getElementById('field-description').value = product.description || '';
            document.getElementById('field-visible').checked = product.visible !== false;
            renderCategoryCheckboxes(product.categories || []);
            deleteBtn.hidden = false;
            deleteBtn.onclick = () => deleteProduct(product.id);
        } else {
            productModalTitle.textContent = 'Agregar producto';
        }
        openModal(productModal);
    }

    addFab.addEventListener('click', () => openProductForm(null));

    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('product-id').value;
        const formData = new FormData();
        formData.set('name', document.getElementById('field-name').value.trim());
        formData.set('price', document.getElementById('field-price').value || '0');
        formData.set('presentation_qty', document.getElementById('field-qty').value.trim());
        formData.set('presentation_unit', document.getElementById('field-unit').value.trim());
        formData.set('description', document.getElementById('field-description').value.trim());
        formData.set('visible', document.getElementById('field-visible').checked ? '1' : '0');

        const selectedCats = Array.from(
            categoryCheckboxesEl.querySelectorAll('input:checked')
        ).map((el) => el.value);
        for (const catId of selectedCats) formData.append('categories', catId);

        const fileInput = document.getElementById('field-image');
        if (fileInput.files[0]) formData.set('image', fileInput.files[0]);

        try {
            if (id) {
                await fetchJSON(`/api/products/${id}`, { method: 'PUT', body: formData });
            } else {
                await fetchJSON('/api/products', { method: 'POST', body: formData });
            }
            closeModal(productModal);
            await loadProducts();
        } catch (err) {
            alert(err.message || 'No se pudo guardar el producto');
        }
    });

    async function deleteProduct(id) {
        if (!confirm('¿Eliminar este producto? Esta acción no se puede deshacer.')) return;
        try {
            await fetchJSON(`/api/products/${id}`, { method: 'DELETE' });
            closeModal(productModal);
            await loadProducts();
        } catch (err) {
            alert(err.message || 'No se pudo eliminar el producto');
        }
    }

    // ─────────────────── INIT ───────────────────

    async function init() {
        try {
            state.categories = await fetchJSON('/api/categories');
        } catch (err) {
            console.error('No se pudieron cargar las categorías', err);
        }
        renderChips();
        await refreshAdminStatus();

        searchInput.addEventListener('input', debounce((e) => {
            state.query = e.target.value.trim();
            loadProducts();
        }, 250));

        await loadProducts();
    }

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch((err) => {
                console.error('No se pudo registrar el service worker', err);
            });
        });
    }

    init();
})();
