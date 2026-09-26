(() => {
    'use strict';

    const searchInput = document.getElementById('search-input');
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
    const currentPhotoWrap = document.getElementById('current-photo-wrap');
    const currentPhotoImg = document.getElementById('current-photo-img');
    const rotateLeftBtn = document.getElementById('rotate-left-btn');
    const rotateRightBtn = document.getElementById('rotate-right-btn');
    const rotateHint = document.getElementById('rotate-hint');

    const categoriesBtn = document.getElementById('categories-btn');
    const categoriesModal = document.getElementById('categories-modal');
    const categoryAddForm = document.getElementById('category-add-form');
    const newCategoryNameInput = document.getElementById('new-category-name');
    const categoryListEl = document.getElementById('category-list');

    const quickviewModal = document.getElementById('quickview-modal');
    const quickviewStage = document.getElementById('quickview-stage');
    const quickviewImg = document.getElementById('quickview-img');
    const quickviewName = document.getElementById('quickview-name');
    const quickviewMeta = document.getElementById('quickview-meta');
    const quickviewPrice = document.getElementById('quickview-price');
    const quickviewDescription = document.getElementById('quickview-description');
    const quickviewCounter = document.getElementById('quickview-counter');
    const quickviewPrev = document.getElementById('quickview-prev');
    const quickviewNext = document.getElementById('quickview-next');
    const quickviewShareBtn = document.getElementById('quickview-share-btn');
    const quickviewAdminActions = document.getElementById('quickview-admin-actions');
    const quickviewRotateLeft = document.getElementById('quickview-rotate-left');
    const quickviewRotateRight = document.getElementById('quickview-rotate-right');
    const quickviewRotateSave = document.getElementById('quickview-rotate-save');
    const quickviewRotateCancel = document.getElementById('quickview-rotate-cancel');
    const quickviewEditBtn = document.getElementById('quickview-edit-btn');

    const sortSelect = document.getElementById('sort-select');
    const gridSentinel = document.getElementById('grid-sentinel');

    const scanBtn = document.getElementById('scan-btn');
    const scanModal = document.getElementById('scan-modal');
    const scanVideo = document.getElementById('scan-video');
    const scanStatus = document.getElementById('scan-status');
    const scanCancelBtn = document.getElementById('scan-cancel-btn');
    const scanBarcodeFieldBtn = document.getElementById('scan-barcode-field-btn');
    const fieldBarcode = document.getElementById('field-barcode');

    const adminFiltersEl = document.getElementById('admin-filters');
    const adminFilterButtons = Array.from(adminFiltersEl.querySelectorAll('[data-filter]'));

    const categoriesDrawerBtn = document.getElementById('categories-drawer-btn');
    const categoryDrawerModal = document.getElementById('category-drawer-modal');
    const categoryDrawerListEl = document.getElementById('category-drawer-list');
    const categorySelectorLabelEl = document.getElementById('category-selector-label');

    const state = {
        query: '',
        categoryId: null,
        categories: [],
        isAdmin: false,
        specialFilter: null,
        sort: 'recent',
        products: [],   // resultado del servidor, sin ordenar
        items: [],      // products ya ordenados: es lo que se muestra y por lo que navega la vista rápida
        rendered: 0,    // cuántos tiles ya están en el DOM (carga progresiva)
    };

    const PAGE_SIZE = 24;

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
        'category-drawer': categoryDrawerModal,
        quickview: quickviewModal,
    };

    // La URL lleva updated_at para que una foto editada o rotada se descargue de nuevo
    // (en este y en los demás teléfonos) en vez de servirse desde la caché.
    function imageUrl(product) {
        const base = `/static/images/${product.image}`;
        return product.updated_at ? `${base}?v=${encodeURIComponent(product.updated_at)}` : base;
    }

    function preloadImage(url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = img.onerror = () => resolve();
            img.src = url;
        });
    }

    function normalizeRotation(deg) {
        return ((deg % 360) + 360) % 360;
    }

    document.querySelectorAll('[data-close]').forEach((el) => {
        el.addEventListener('click', () => {
            closeModal(modalsByKey[el.dataset.close]);
        });
    });

    // ─────────────────── BARCODE SCANNER ───────────────────

    const scanSupported = 'BarcodeDetector' in window;
    let scanStream = null;
    let scanCancelled = false;

    if (!scanSupported) {
        scanBtn.disabled = true;
        if (scanBarcodeFieldBtn) scanBarcodeFieldBtn.disabled = true;
    }

    function stopScanner() {
        scanCancelled = true;
        if (scanStream) {
            scanStream.getTracks().forEach((track) => track.stop());
            scanStream = null;
        }
        scanVideo.srcObject = null;
        closeModal(scanModal);
    }

    async function openScanner(onResult) {
        if (!scanSupported) {
            alert('Tu navegador no soporta escaneo de cámara (funciona en Chrome/Android). Usa la búsqueda por texto.');
            return;
        }

        scanCancelled = false;
        scanStatus.textContent = 'Apunta al código de barras…';
        openModal(scanModal);

        try {
            scanStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
            });
        } catch (err) {
            scanStatus.textContent = 'No se pudo acceder a la cámara (revisa los permisos, y que el sitio use HTTPS).';
            return;
        }

        scanVideo.srcObject = scanStream;
        await scanVideo.play();

        const detector = new window.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'],
        });

        const detectLoop = async () => {
            if (scanCancelled) return;
            try {
                const codes = await detector.detect(scanVideo);
                if (codes.length > 0) {
                    const value = codes[0].rawValue;
                    stopScanner();
                    onResult(value);
                    return;
                }
            } catch (err) {
                // Frame sin datos válidos todavía, seguir intentando.
            }
            setTimeout(detectLoop, 200);
        };
        detectLoop();
    }

    scanCancelBtn.addEventListener('click', stopScanner);

    scanBtn.addEventListener('click', () => {
        openScanner(async (code) => {
            searchInput.value = code;
            try {
                const product = await fetchJSON(`/api/products/barcode/${encodeURIComponent(code)}`);
                state.query = product.name;
                searchInput.value = product.name;
                await loadProducts();
            } catch (err) {
                alert(`Código ${code} no encontrado en el catálogo.`);
            }
        });
    });

    if (scanBarcodeFieldBtn) {
        scanBarcodeFieldBtn.addEventListener('click', () => {
            openScanner((code) => {
                fieldBarcode.value = code;
            });
        });
    }

    // ─────────────────── CATEGORY SELECTOR ───────────────────

    function selectCategory(catId) {
        state.categoryId = catId;
        state.specialFilter = null;
        updateCategorySelector();
        renderAdminFilterChips();
        loadProducts();
    }

    function updateCategorySelector() {
        const current = state.categories.find((c) => c.id === state.categoryId);
        categorySelectorLabelEl.textContent = current ? current.name : 'Todas las categorías';
        categoriesDrawerBtn.classList.toggle('category-selector--active', state.categoryId !== null);
        renderCategoryDrawerList();
    }

    function renderCategoryDrawerList() {
        const all = [{ id: null, name: 'Todas' }, ...state.categories];
        categoryDrawerListEl.innerHTML = '';
        for (const cat of all) {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'drawer-list__item' + (state.categoryId === cat.id ? ' drawer-list__item--active' : '');
            btn.textContent = cat.name;
            btn.addEventListener('click', () => {
                selectCategory(cat.id);
                closeModal(categoryDrawerModal);
            });
            li.appendChild(btn);
            categoryDrawerListEl.appendChild(li);
        }
    }

    categoriesDrawerBtn.addEventListener('click', () => {
        renderCategoryDrawerList();
        openModal(categoryDrawerModal);
    });

    // ─────────────────── ADMIN MAINTENANCE FILTERS ───────────────────

    function renderAdminFilterChips() {
        for (const btn of adminFilterButtons) {
            btn.classList.toggle('chip--active', state.specialFilter === btn.dataset.filter);
        }
    }

    function normalizeName(name) {
        return (name || '').trim().toLowerCase();
    }

    function normalizePresentation(value) {
        return (value || '').trim().toLowerCase();
    }

    function findDuplicates(products) {
        const byName = new Map();
        const byBarcode = new Map();
        for (const p of products) {
            // Nombre + cantidad + unidad juntos: "Manzana 1 L" y "Manzana 500 ml"
            // son presentaciones distintas, no duplicados, aunque compartan nombre.
            const nameKey = normalizeName(p.name)
                && `${normalizeName(p.name)}|${normalizePresentation(p.presentation_qty)}|${normalizePresentation(p.presentation_unit)}`;
            if (nameKey) {
                if (!byName.has(nameKey)) byName.set(nameKey, []);
                byName.get(nameKey).push(p);
            }
            if (p.barcode) {
                if (!byBarcode.has(p.barcode)) byBarcode.set(p.barcode, []);
                byBarcode.get(p.barcode).push(p);
            }
        }
        const duplicateIds = new Set();
        for (const group of byName.values()) {
            if (group.length > 1) group.forEach((p) => duplicateIds.add(p.id));
        }
        for (const group of byBarcode.values()) {
            if (group.length > 1) group.forEach((p) => duplicateIds.add(p.id));
        }
        return products
            .filter((p) => duplicateIds.has(p.id))
            .sort((a, b) => normalizeName(a.name).localeCompare(normalizeName(b.name)));
    }

    function applySpecialFilter(products) {
        if (state.specialFilter === 'no-photo') {
            return products.filter((p) => p.image === 'placeholder.webp');
        }
        if (state.specialFilter === 'no-price') {
            return products.filter((p) => !p.price || p.price <= 0);
        }
        if (state.specialFilter === 'duplicates') {
            return findDuplicates(products);
        }
        return products;
    }

    adminFilterButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.filter;
            state.specialFilter = state.specialFilter === key ? null : key;
            state.query = '';
            state.categoryId = null;
            searchInput.value = '';
            updateCategorySelector();
            renderAdminFilterChips();
            loadProducts();
        });
    });

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
        updateCategorySelector();
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
        card.className = 'tile' + (state.isAdmin && !product.visible ? ' tile--hidden-product' : '');
        card.addEventListener('click', () => openQuickView(product));

        const imgWrap = document.createElement('div');
        imgWrap.className = 'tile__img-wrap';
        const img = document.createElement('img');
        img.className = 'tile__img';
        img.loading = 'lazy';
        img.src = imageUrl(product);
        img.alt = product.name;
        imgWrap.appendChild(img);
        card.appendChild(imgWrap);

        if (state.isAdmin) {
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'tile__edit-btn';
            editBtn.textContent = '✏️';
            editBtn.setAttribute('aria-label', 'Editar producto');
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openProductForm(product);
            });
            card.appendChild(editBtn);
        }

        const body = document.createElement('div');
        body.className = 'tile__body';

        const name = document.createElement('div');
        name.className = 'tile__name';
        name.textContent = product.name;
        body.appendChild(name);

        if (product.presentation_qty || product.presentation_unit) {
            const meta = document.createElement('div');
            meta.className = 'tile__meta';
            meta.textContent = `${product.presentation_qty} ${product.presentation_unit}`.trim();
            body.appendChild(meta);
        }

        const price = document.createElement('div');
        price.className = 'tile__price';
        price.textContent = priceFormatter.format(product.price || 0);
        body.appendChild(price);

        if (state.isAdmin && !product.visible) {
            const badge = document.createElement('div');
            badge.className = 'tile__hidden-badge';
            badge.textContent = 'Oculto para clientes';
            body.appendChild(badge);
        }

        card.appendChild(body);

        return card;
    }

    // ─────────────────── ORDEN + CARGA PROGRESIVA ───────────────────

    const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

    function sortProducts(products) {
        // "Duplicados" ya viene agrupado por nombre; reordenarlo rompería el agrupamiento.
        if (state.sort === 'recent' || state.specialFilter === 'duplicates') return products;
        const list = products.slice();
        const byName = (a, b) => collator.compare(a.name, b.name);
        if (state.sort === 'name') list.sort(byName);
        else if (state.sort === 'price-asc') list.sort((a, b) => (a.price || 0) - (b.price || 0) || byName(a, b));
        else if (state.sort === 'price-desc') list.sort((a, b) => (b.price || 0) - (a.price || 0) || byName(a, b));
        return list;
    }

    function renderMore(count) {
        const end = Math.min(state.rendered + count, state.items.length);
        const frag = document.createDocumentFragment();
        for (let i = state.rendered; i < end; i++) frag.appendChild(productCard(state.items[i]));
        gridEl.appendChild(frag);
        state.rendered = end;
    }

    // Renderiza por lotes mientras el final de la lista esté cerca de la pantalla.
    function fillViewport() {
        while (state.rendered < state.items.length
               && gridSentinel.getBoundingClientRect().top < window.innerHeight + 800) {
            renderMore(PAGE_SIZE);
        }
    }

    if ('IntersectionObserver' in window) {
        new IntersectionObserver((entries) => {
            if (entries.some((e) => e.isIntersecting)) fillViewport();
        }, { rootMargin: '800px 0px' }).observe(gridSentinel);
    } else {
        window.addEventListener('scroll', fillViewport, { passive: true });
    }

    function applyView(keepRendered) {
        const previouslyRendered = state.rendered;
        state.items = sortProducts(state.products);
        gridEl.innerHTML = '';
        state.rendered = 0;
        emptyEl.hidden = state.items.length > 0;
        // Si es la misma vista (p. ej. tras editar), conserva cuántos tiles había para no perder el scroll.
        renderMore(keepRendered ? Math.max(PAGE_SIZE, previouslyRendered) : PAGE_SIZE);
        fillViewport();
        syncQuickView();
    }

    try {
        const saved = localStorage.getItem('catalogo-sort');
        if (saved && Array.from(sortSelect.options).some((o) => o.value === saved)) state.sort = saved;
    } catch (err) { /* sin localStorage: se queda en "recientes" */ }
    sortSelect.value = state.sort;

    sortSelect.addEventListener('change', () => {
        state.sort = sortSelect.value;
        try { localStorage.setItem('catalogo-sort', state.sort); } catch (err) { /* ignorar */ }
        applyView(false);
        window.scrollTo({ top: 0 });
    });

    // ─────────────────── QUICK VIEW (ventana flotante) ───────────────────

    let quickViewId = null;
    let quickViewIndex = -1;
    let quickRotation = 0;   // giro pendiente (vista previa) en grados, sentido horario

    const zoom = { scale: 1, x: 0, y: 0 };
    const ZOOM_MAX = 4;
    const pointers = new Map();
    let swipe = null;
    let pinch = null;
    let lastTap = 0;

    function quickViewProduct() {
        return state.items[quickViewIndex] || null;
    }

    function applyImageTransform() {
        quickviewImg.style.transform =
            `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale}) rotate(${quickRotation}deg)`;
        quickviewStage.style.cursor = zoom.scale > 1 ? 'grab' : 'zoom-in';
    }

    function clampPan() {
        const maxX = (quickviewStage.clientWidth * (zoom.scale - 1)) / 2;
        const maxY = (quickviewStage.clientHeight * (zoom.scale - 1)) / 2;
        zoom.x = Math.min(maxX, Math.max(-maxX, zoom.x));
        zoom.y = Math.min(maxY, Math.max(-maxY, zoom.y));
    }

    function resetZoom() {
        zoom.scale = 1;
        zoom.x = 0;
        zoom.y = 0;
        applyImageTransform();
    }

    // (cx, cy) es el punto a mantener fijo, relativo al centro del contenedor.
    function zoomAt(cx, cy, newScale) {
        const scale = Math.min(ZOOM_MAX, Math.max(1, newScale));
        const k = scale / zoom.scale;
        zoom.x = cx - k * (cx - zoom.x);
        zoom.y = cy - k * (cy - zoom.y);
        zoom.scale = scale;
        clampPan();
        applyImageTransform();
    }

    function relativeToCenter(clientX, clientY) {
        const rect = quickviewStage.getBoundingClientRect();
        return { x: clientX - (rect.left + rect.width / 2), y: clientY - (rect.top + rect.height / 2) };
    }

    function updateRotateUI() {
        const pending = normalizeRotation(quickRotation) !== 0;
        quickviewRotateSave.hidden = !pending;
        quickviewRotateCancel.hidden = !pending;
    }

    function resetRotatePreview() {
        quickRotation = 0;
        updateRotateUI();
    }

    function fillQuickView(product) {
        quickviewImg.src = imageUrl(product);
        quickviewImg.alt = product.name;
        quickviewName.textContent = product.name;

        const meta = `${product.presentation_qty || ''} ${product.presentation_unit || ''}`.trim();
        quickviewMeta.textContent = meta;
        quickviewMeta.hidden = !meta;

        quickviewPrice.textContent = priceFormatter.format(product.price || 0);

        quickviewDescription.textContent = product.description || '';
        quickviewDescription.hidden = !product.description;

        quickviewAdminActions.hidden = !state.isAdmin;

        const total = state.items.length;
        quickviewCounter.textContent = `${quickViewIndex + 1} / ${total}`;
        quickviewPrev.hidden = quickViewIndex <= 0;
        quickviewNext.hidden = quickViewIndex >= total - 1;
    }

    function showQuickView(index) {
        const product = state.items[index];
        if (!product) return;
        quickViewIndex = index;
        quickViewId = product.id;
        resetZoom();
        resetRotatePreview();
        fillQuickView(product);
        // Precarga los vecinos para que al deslizar la foto ya esté lista.
        for (const neighbor of [state.items[index - 1], state.items[index + 1]]) {
            if (neighbor) preloadImage(imageUrl(neighbor));
        }
    }

    function openQuickView(product) {
        const index = state.items.findIndex((p) => p.id === product.id);
        if (index < 0) return;
        showQuickView(index);
        openModal(quickviewModal);
    }

    function stepQuickView(delta) {
        const next = quickViewIndex + delta;
        if (next >= 0 && next < state.items.length) showQuickView(next);
    }

    // Tras recargar la lista (editar, rotar, filtrar) mantiene abierta la vista rápida en el mismo producto.
    function syncQuickView() {
        if (quickviewModal.hidden) return;
        const index = state.items.findIndex((p) => p.id === quickViewId);
        if (index < 0) {
            closeModal(quickviewModal);
            return;
        }
        quickViewIndex = index;
        fillQuickView(state.items[index]);
    }

    function closeQuickView() {
        closeModal(quickviewModal);
        pointers.clear();
        swipe = null;
        pinch = null;
    }

    document.querySelectorAll('[data-close="quickview"]').forEach((el) => {
        el.addEventListener('click', closeQuickView);
    });

    quickviewPrev.addEventListener('click', () => stepQuickView(-1));
    quickviewNext.addEventListener('click', () => stepQuickView(1));

    document.addEventListener('keydown', (e) => {
        if (quickviewModal.hidden) return;
        if (e.key === 'ArrowLeft') stepQuickView(-1);
        else if (e.key === 'ArrowRight') stepQuickView(1);
        else if (e.key === 'Escape') closeQuickView();
    });

    // Gestos sobre la foto: pellizcar / rueda para zoom, arrastrar para mover con zoom,
    // deslizar horizontalmente (sin zoom) para cambiar de producto, doble tap para acercar.
    quickviewStage.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        try { quickviewStage.setPointerCapture(e.pointerId); } catch (err) { /* puntero ya inactivo */ }
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        quickviewStage.classList.add('is-gesturing');
        if (pointers.size === 2) {
            swipe = null;
            const [a, b] = Array.from(pointers.values());
            pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2 };
        } else if (pointers.size === 1) {
            swipe = { startX: e.clientX, startY: e.clientY, moved: false };
        }
    });

    quickviewStage.addEventListener('pointermove', (e) => {
        const pointer = pointers.get(e.pointerId);
        if (!pointer) return;
        const dx = e.clientX - pointer.x;
        const dy = e.clientY - pointer.y;
        pointer.x = e.clientX;
        pointer.y = e.clientY;

        if (pointers.size === 2 && pinch) {
            const [a, b] = Array.from(pointers.values());
            const dist = Math.hypot(a.x - b.x, a.y - b.y);
            const midX = (a.x + b.x) / 2;
            const midY = (a.y + b.y) / 2;
            const c = relativeToCenter(midX, midY);
            zoomAt(c.x, c.y, zoom.scale * (dist / pinch.dist));
            zoom.x += midX - pinch.midX;
            zoom.y += midY - pinch.midY;
            clampPan();
            applyImageTransform();
            pinch = { dist, midX, midY };
        } else if (pointers.size === 1) {
            if (zoom.scale > 1) {
                zoom.x += dx;
                zoom.y += dy;
                clampPan();
                applyImageTransform();
            }
            if (swipe && Math.hypot(e.clientX - swipe.startX, e.clientY - swipe.startY) > 8) swipe.moved = true;
        }
    });

    function endPointer(e) {
        if (!pointers.has(e.pointerId)) return;
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinch = null;
        if (pointers.size > 0) {
            swipe = null;   // se soltó un dedo tras pellizcar: no cuenta como deslizar
            return;
        }
        quickviewStage.classList.remove('is-gesturing');
        if (swipe && e.type === 'pointerup') {
            const dx = e.clientX - swipe.startX;
            const dy = e.clientY - swipe.startY;
            if (!swipe.moved) {
                const now = Date.now();
                if (now - lastTap < 300) {
                    lastTap = 0;
                    if (zoom.scale > 1) {
                        resetZoom();
                    } else {
                        const c = relativeToCenter(e.clientX, e.clientY);
                        zoomAt(c.x, c.y, 2.5);
                    }
                } else {
                    lastTap = now;
                }
            } else if (zoom.scale === 1 && e.pointerType !== 'mouse'
                       && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                stepQuickView(dx < 0 ? 1 : -1);
            }
        }
        swipe = null;
        if (zoom.scale < 1.05) resetZoom();
    }

    quickviewStage.addEventListener('pointerup', endPointer);
    quickviewStage.addEventListener('pointercancel', endPointer);

    let wheelTimer = null;
    quickviewStage.addEventListener('wheel', (e) => {
        e.preventDefault();
        quickviewStage.classList.add('is-gesturing');
        clearTimeout(wheelTimer);
        wheelTimer = setTimeout(() => quickviewStage.classList.remove('is-gesturing'), 150);
        const c = relativeToCenter(e.clientX, e.clientY);
        zoomAt(c.x, c.y, zoom.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
        if (zoom.scale < 1.05) resetZoom();
    }, { passive: false });

    // ── Giro de la foto (admin): primero vista previa, se guarda al confirmar ──

    function rotateQuickPreview(delta) {
        quickRotation += delta;
        updateRotateUI();
        applyImageTransform();
    }

    quickviewRotateLeft.addEventListener('click', () => rotateQuickPreview(-90));
    quickviewRotateRight.addEventListener('click', () => rotateQuickPreview(90));

    quickviewRotateCancel.addEventListener('click', () => {
        resetRotatePreview();
        applyImageTransform();
    });

    quickviewRotateSave.addEventListener('click', async () => {
        const product = quickViewProduct();
        const degrees = normalizeRotation(quickRotation);
        if (!product || degrees === 0) return;
        quickviewRotateSave.disabled = true;
        try {
            const updated = await fetchJSON(`/api/products/${product.id}/rotate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ degrees }),
            });
            Object.assign(product, updated);
            // Espera a que cargue la foto ya girada para quitar la vista previa sin parpadeo.
            await preloadImage(imageUrl(product));
            quickviewStage.classList.add('is-gesturing');
            resetRotatePreview();
            fillQuickView(product);
            applyImageTransform();
            requestAnimationFrame(() => quickviewStage.classList.remove('is-gesturing'));
            await loadProducts();
        } catch (err) {
            alert(err.message || 'No se pudo rotar la imagen');
        } finally {
            quickviewRotateSave.disabled = false;
        }
    });

    quickviewEditBtn.addEventListener('click', () => {
        const product = quickViewProduct();
        closeQuickView();
        if (product) openProductForm(product);
    });

    // ── Compartir ──

    // Convierte la foto (WebP con fondo transparente) a JPEG con fondo blanco:
    // WhatsApp y otras apps la aceptan mejor así.
    async function productImageFile(product) {
        const img = new Image();
        img.src = imageUrl(product);
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
        if (!blob) throw new Error('No se pudo preparar la imagen');
        return new File([blob], 'producto.jpg', { type: 'image/jpeg' });
    }

    quickviewShareBtn.addEventListener('click', async () => {
        const product = quickViewProduct();
        if (!product) return;
        const meta = `${product.presentation_qty || ''} ${product.presentation_unit || ''}`.trim();
        const text = `${product.name}${meta ? ` ${meta}` : ''} — ${priceFormatter.format(product.price || 0)}`;

        if (navigator.share) {
            try {
                let shareData = { text };
                try {
                    const file = await productImageFile(product);
                    if (navigator.canShare && navigator.canShare({ files: [file] })) shareData = { text, files: [file] };
                } catch (err) { /* sin foto: se comparte solo el texto */ }
                await navigator.share(shareData);
                return;
            } catch (err) {
                if (err.name === 'AbortError') return;   // el usuario cerró el menú de compartir
            }
        }
        // Sin Web Share (escritorio o página sin HTTPS): abre WhatsApp con el texto.
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    });

    // ─────────────────── CARGA DE PRODUCTOS ───────────────────

    async function loadProducts() {
        loadingEl.hidden = false;
        try {
            let products;
            if (state.specialFilter) {
                const all = await fetchJSON('/api/products');
                products = applySpecialFilter(all);
            } else if (state.query || state.categoryId) {
                const params = new URLSearchParams();
                params.set('q', state.query);
                if (state.categoryId) params.set('category', state.categoryId);
                products = await fetchJSON(`/api/products/search?${params.toString()}`);
            } else {
                products = await fetchJSON('/api/products');
            }
            const viewKey = JSON.stringify([state.query, state.categoryId, state.specialFilter, state.isAdmin]);
            const sameView = viewKey === state.viewKey;
            state.viewKey = viewKey;
            state.products = products;
            applyView(sameView);
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
        adminFiltersEl.hidden = !state.isAdmin;
        addFab.hidden = !state.isAdmin;
        adminToggleBtn.textContent = state.isAdmin ? '🔓' : '🔒';
        if (!state.isAdmin) {
            state.specialFilter = null;
            renderAdminFilterChips();
        }
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

    let editingProduct = null;
    let formRotation = 0;   // giro pendiente de la foto (vista previa); se guarda con el producto

    function updateFormRotation() {
        currentPhotoImg.style.transform = `rotate(${formRotation}deg)`;
        rotateHint.hidden = normalizeRotation(formRotation) === 0;
    }

    function resetProductForm() {
        productForm.reset();
        document.getElementById('product-id').value = '';
        document.getElementById('field-visible').checked = true;
        fieldBarcode.value = '';
        deleteBtn.hidden = true;
        editingProduct = null;
        formRotation = 0;
        currentPhotoWrap.hidden = true;
        currentPhotoImg.style.transform = '';
        rotateHint.hidden = true;
        renderCategoryCheckboxes([]);
    }

    function openProductForm(product) {
        resetProductForm();
        if (product) {
            editingProduct = product;
            productModalTitle.textContent = 'Editar producto';
            document.getElementById('product-id').value = product.id;
            document.getElementById('field-name').value = product.name;
            document.getElementById('field-price').value = product.price;
            document.getElementById('field-qty').value = product.presentation_qty || '';
            document.getElementById('field-unit').value = product.presentation_unit || '';
            document.getElementById('field-description').value = product.description || '';
            document.getElementById('field-visible').checked = product.visible !== false;
            fieldBarcode.value = product.barcode || '';
            renderCategoryCheckboxes(product.categories || []);
            deleteBtn.hidden = false;
            deleteBtn.onclick = () => deleteProduct(product.id);
            if (product.image && product.image !== 'placeholder.webp') {
                currentPhotoImg.src = imageUrl(product);
                currentPhotoWrap.hidden = false;
            }
        } else {
            productModalTitle.textContent = 'Agregar producto';
        }
        openModal(productModal);
    }

    rotateLeftBtn.addEventListener('click', () => {
        formRotation -= 90;
        updateFormRotation();
    });

    rotateRightBtn.addEventListener('click', () => {
        formRotation += 90;
        updateFormRotation();
    });

    // Con una foto nueva el giro pendiente ya no aplica.
    document.getElementById('field-image').addEventListener('change', (e) => {
        if (e.target.files[0]) {
            formRotation = 0;
            updateFormRotation();
        }
    });

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
        formData.set('barcode', fieldBarcode.value.trim());

        const selectedCats = Array.from(
            categoryCheckboxesEl.querySelectorAll('input:checked')
        ).map((el) => el.value);
        for (const catId of selectedCats) formData.append('categories', catId);

        const fileInput = document.getElementById('field-image');
        if (fileInput.files[0]) {
            formData.set('image', fileInput.files[0]);
        } else if (id && normalizeRotation(formRotation) !== 0) {
            formData.set('rotate', String(normalizeRotation(formRotation)));
        }

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
        updateCategorySelector();
        await refreshAdminStatus();

        searchInput.addEventListener('input', debounce((e) => {
            state.query = e.target.value.trim();
            if (state.specialFilter) {
                state.specialFilter = null;
                renderAdminFilterChips();
            }
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
