(() => {
    'use strict';

    const searchInput = document.getElementById('search-input');
    const chipsEl = document.getElementById('category-chips');
    const gridEl = document.getElementById('product-grid');
    const emptyEl = document.getElementById('empty-state');
    const loadingEl = document.getElementById('loading-state');

    const state = {
        query: '',
        categoryId: null,
        categories: [],
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

    async function fetchJSON(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.json();
    }

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

    function productCard(product) {
        const card = document.createElement('article');
        card.className = 'card';

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

    async function init() {
        try {
            state.categories = await fetchJSON('/api/categories');
        } catch (err) {
            console.error('No se pudieron cargar las categorías', err);
        }
        renderChips();

        searchInput.addEventListener('input', debounce((e) => {
            state.query = e.target.value.trim();
            loadProducts();
        }, 250));

        await loadProducts();
    }

    init();
})();
