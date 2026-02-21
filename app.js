/* app.js - Main Application Logic */

// --- State Management ---
let cart = [];
let currentProducts = [];
let lastSale = null;
let currentProductImage = null; // Stores data URL of the selected/pasted image
let salesCurrentPage = 1;
const salesItemsPerPage = 10;

// --- DOM Elements ---
const views = {
    pos: document.getElementById('pos-section'),
    products: document.getElementById('products-section'),
    sales: document.getElementById('sales-section'),
    dashboard: document.getElementById('dashboard-section')
};

let posViewMode = 'grid'; // 'grid' or 'list'

const productModal = document.getElementById('product-modal');
const productForm = document.getElementById('product-form');
const checkoutModal = document.getElementById('checkout-modal'); // Note: This might be null if not in HTML

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (typeof lucide !== 'undefined') lucide.createIcons();

        setupNavigation();
        await loadProducts();
        updateCartUI(); // Initialize cart state
        updateDate();
        setInterval(updateDate, 60000);

        // Ensure Global Print Sales function is available
        window.printSalesHistory = printSalesHistory;

        // Event Listeners for POS
        const searchInput = document.getElementById('pos-search');
        if (searchInput) {
            searchInput.addEventListener('input', filterProducts);
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const code = searchInput.value.trim();
                    if (code) {
                        const product = currentProducts.find(p => p.code === code);
                        if (product) {
                            addToCart(product);
                            searchInput.value = '';
                            filterProducts(); // Reset filter
                        }
                    } else if (cart.length > 0) {
                        // Empty search + Enter = Pay Now
                        openPaymentModal();
                    }
                }
            });
        }

        const catFilter = document.getElementById('pos-category-filter');
        if (catFilter) catFilter.addEventListener('change', filterProducts);

        const clearBtn = document.getElementById('clear-cart-btn');
        if (clearBtn) clearBtn.addEventListener('click', clearCart);

        const checkoutBtn = document.getElementById('checkout-btn');
        if (checkoutBtn) checkoutBtn.addEventListener('click', openPaymentModal);

        // Event Listeners for Payment
        const confirmBtn = document.getElementById('confirm-payment-btn');
        if (confirmBtn) confirmBtn.addEventListener('click', finalizeSale);

        const paymentInput = document.getElementById('payment-cash');
        if (paymentInput) {
            paymentInput.addEventListener('input', updatePaymentBalance);
            paymentInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    finalizeSale();
                }
            });
        }



        // Event Listeners for Inventory
        const invSearch = document.getElementById('inventory-search');
        if (invSearch) invSearch.addEventListener('input', loadInventoryTable);

        const invFilter = document.getElementById('inventory-filter');
        if (invFilter) invFilter.addEventListener('change', loadInventoryTable);

        // Event Listeners for Sales History
        const salesDateFilter = document.getElementById('sales-filter-date');
        if (salesDateFilter) salesDateFilter.addEventListener('change', loadSalesHistory);

        // Image Handling (File Input)
        const fileInput = document.getElementById('product-image');
        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    currentProductImage = await readFile(file);
                    updateImagePreview(currentProductImage);
                }
            });
        }

        // Image Handling (Paste)
        document.addEventListener('paste', async (e) => {
            // Only handle paste if the product modal is visible
            const modal = document.getElementById('product-modal');
            if (modal && !modal.classList.contains('hidden')) {
                const items = (e.clipboardData || e.originalEvent.clipboardData).items;
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                        const blob = items[i].getAsFile();
                        currentProductImage = await readFile(blob);
                        updateImagePreview(currentProductImage);
                        break;
                    }
                }
            }
        });

        // Terminal Input (Quick Add)
        const terminalInput = document.getElementById('pos-terminal-input');
        if (terminalInput) {
            terminalInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    let code = terminalInput.value.trim();
                    if (code) {
                        // Support numeric-only codes by padding and adding PRD- prefix
                        if (/^\d+$/.test(code)) {
                            const formattedCode = `PRD-${code.padStart(8, '0')}`;
                            let product = currentProducts.find(p => p.code === formattedCode);

                            if (product) {
                                addToCart(product);
                                terminalInput.value = '';
                                return;
                            }
                        }

                        // Original search logic
                        const product = currentProducts.find(p => p.code === code);
                        if (product) {
                            addToCart(product);
                            terminalInput.value = '';
                        } else {
                            // Flash red for not found
                            terminalInput.classList.add('border-red-500', 'bg-red-50');
                            setTimeout(() => terminalInput.classList.remove('border-red-500', 'bg-red-50'), 500);
                        }
                    } else if (cart.length > 0) {
                        openPaymentModal();
                    }
                }
            });
        }

        // Product Form
        if (productForm) productForm.addEventListener('submit', handleProductSubmit);

        // Category Form
        const categoryForm = document.getElementById('add-category-form');
        if (categoryForm) {
            categoryForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const nameInput = document.getElementById('new-category-name');
                const name = nameInput.value.trim();
                if (name) {
                    await addCategory({ name });
                    nameInput.value = '';
                    await loadCategories();
                }
            });
        }

        // Initial Load
        loadInventoryTable();
        updateReports();
        setupLockTimer();
        setupMobileToggles();

        // Set Initial View
        const dashboardNav = document.querySelector('[data-target="dashboard-section"]');
        if (dashboardNav) dashboardNav.click();

        console.log("App Initialized Successfully");
    } catch (e) {
        console.error("Initialization Error:", e);
        alert("An error occurred while initializing the application. Check console for details.");
    }
});

function updateDate() {
    const now = new Date();
    const dateEl = document.getElementById('current-date');
    const timeEl = document.getElementById('current-time');
    if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (timeEl) timeEl.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// --- Navigation ---
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', async (e) => {
            e.preventDefault();
            const target = item.getAttribute('data-target');

            // Update UI
            navItems.forEach(i => i.classList.remove('active', 'bg-indigo-600', 'text-white'));
            navItems.forEach(i => i.classList.add('text-slate-400'));
            item.classList.add('active', 'bg-indigo-600', 'text-white');
            item.classList.remove('text-slate-400');

            // Show section
            document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
            const targetSection = document.getElementById(target);
            if (targetSection) targetSection.classList.remove('hidden');

            // Update title
            const title = item.querySelector('span').textContent;
            document.getElementById('page-title').textContent = title;

            // Load specific data
            if (target === 'inventory-section' || target === 'products-section') {
                loadInventoryTable();
            } else if (target === 'sales-section') {
                loadSalesHistory();
            } else if (target === 'dashboard-section') {
                updateReports();
            } else if (target === 'categories-section') {
                loadCategoriesPage();
            }

            // Auto-close sidebar on mobile
            if (window.innerWidth < 1024) {
                const sidebar = document.getElementById('sidebar');
                const backdrop = document.getElementById('sidebar-backdrop');
                if (sidebar) sidebar.classList.add('-translate-x-full');
                if (backdrop) backdrop.classList.add('hidden');
            }
        });
    });
}

// --- Mobile Responsiveness Helpers ---
window.toggleSidebar = function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');

    if (window.innerWidth < 1024) {
        // Mobile Toggle logic
        const isHidden = sidebar.classList.contains('-translate-x-full');
        if (isHidden) {
            sidebar.classList.remove('-translate-x-full');
            backdrop.classList.remove('hidden');
        } else {
            sidebar.classList.add('-translate-x-full');
            backdrop.classList.add('hidden');
        }
    } else {
        // Desktop Toggle logic
        const body = document.body;
        const isCollapsed = body.classList.contains('sidebar-collapsed');
        if (isCollapsed) {
            body.classList.remove('sidebar-collapsed');
            sidebar.classList.remove('w-20');
            sidebar.classList.add('w-64');
            // Show text spans
            sidebar.querySelectorAll('span').forEach(s => s.classList.remove('hidden'));
            // Center icons? handled by w-20 usually
        } else {
            body.classList.add('sidebar-collapsed');
            sidebar.classList.remove('w-64');
            sidebar.classList.add('w-20');
            // Hide text spans
            sidebar.querySelectorAll('span').forEach(s => s.classList.add('hidden'));
        }
    }
}

window.toggleCart = function () {
    const cartEl = document.getElementById('cart-panel');
    const backdrop = document.getElementById('cart-backdrop');
    if (cartEl && backdrop) {
        cartEl.classList.toggle('translate-x-full');
        backdrop.classList.toggle('hidden');
    }
};

function setupMobileToggles() {
    const menuBtn = document.getElementById('mobile-menu-btn');
    const sidebarBackdrop = document.getElementById('sidebar-backdrop');
    const cartToggle = document.getElementById('mobile-cart-toggle');
    const cartBackdrop = document.getElementById('cart-backdrop');

    if (menuBtn) menuBtn.addEventListener('click', toggleSidebar);
    if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', toggleSidebar);
    if (cartToggle) cartToggle.addEventListener('click', toggleCart);
    if (cartBackdrop) cartBackdrop.addEventListener('click', toggleCart);

    // Modal Close Buttons (since onclicks were removed for standardizing)
    const closeSaleDetailBtn = document.getElementById('close-sale-detail-btn');
    const closeSaleDetailBtnBottom = document.getElementById('close-sale-detail-btn-bottom');
    if (closeSaleDetailBtn) closeSaleDetailBtn.addEventListener('click', closeSaleDetailModal);
    if (closeSaleDetailBtnBottom) closeSaleDetailBtnBottom.addEventListener('click', closeSaleDetailModal);
}

// --- POS Logic ---

async function loadProducts() {
    try {
        if (typeof getAllProducts === 'function') {
            currentProducts = await getAllProducts();
            await loadCategories(); // Ensure categories are loaded for filter/form
            renderProductGrid(currentProducts);
        } else {
            console.error("getAllProducts is not defined");
        }
    } catch (e) {
        console.error("Detailed Error loading products:", e);
    }
}

async function loadCategories() {
    try {
        let categories = await getAllCategories();

        // Migration: If no categories exist, seed
        if (categories.length === 0) {
            const defaults = ["Women's Wear", "Kids' Wear", "Baby Diapers", "Adult Diapers", "Decoration Items", "Gift Items", "Cosmetics & Perfumes", "Another Items"];
            for (const name of defaults) {
                await addCategory({ name });
            }
            categories = await getAllCategories();
        }

        // Update Dropdowns
        const catFilter = document.getElementById('pos-category-filter');
        const prodCat = document.getElementById('product-category');

        if (catFilter) {
            const currentVal = catFilter.value;
            catFilter.innerHTML = '<option value="all">All Categories</option>';
            categories.forEach(cat => {
                catFilter.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
            });
            catFilter.value = currentVal;
            if (!catFilter.value) catFilter.value = 'all';
        }

        if (prodCat) {
            prodCat.innerHTML = '';
            categories.forEach(cat => {
                prodCat.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
            });
        }
    } catch (e) {
        console.error("Error loading categories:", e);
    }
}

async function loadCategoriesPage() {
    try {
        const categories = await getAllCategories();
        const tbody = document.getElementById('categories-table-body');
        if (!tbody) return;

        tbody.innerHTML = '';
        categories.forEach(cat => {
            const row = document.createElement('tr');
            row.className = "hover:bg-slate-50 border-b border-slate-100";
            row.innerHTML = `
                <td class="p-4 text-sm font-medium text-slate-700">${cat.name}</td>
                <td class="p-4 text-center">
                    <button onclick="confirmDeleteCategory(${cat.id})" class="text-red-500 hover:text-red-700 p-2">
                        <i data-lucide="trash-2" class="w-5 h-5"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        console.error("Error loading categories page:", e);
    }
}

async function handleCategoryAdd(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('standalone-category-name');
    const name = input.value.trim();
    if (!name) return;

    try {
        await addCategory({ name });
        input.value = '';
        loadCategoriesPage();
        loadCategories(); // Update dropdowns
        alert("Category added successfully");
    } catch (err) {
        console.error("Add category error:", err);
        alert("Failed to add category");
    }
}


async function reloadAppData() {
    try {
        await loadProducts();
        alert("Database Reloaded Successfully!");
    } catch (e) {
        console.error("Reload Error:", e);
        alert("Failed to reload database.");
    }
}

async function confirmDeleteCategory(id) {
    if (confirm("Are you sure you want to delete this category? Products in this category will not be deleted.")) {
        await deleteCategory(id);
        await loadCategories();
        loadCategoriesPage();
    }
}

window.confirmDeleteCategory = confirmDeleteCategory;
window.handleCategoryAdd = handleCategoryAdd;
window.toggleSidebar = toggleSidebar;
window.reloadAppData = reloadAppData;

function setPOSViewMode(mode) {
    posViewMode = mode;

    // Update UI buttons
    const gridBtn = document.getElementById('view-grid-btn');
    const listBtn = document.getElementById('view-list-btn');

    if (gridBtn && listBtn) {
        if (mode === 'grid') {
            gridBtn.classList.add('bg-indigo-50', 'text-indigo-600');
            gridBtn.classList.remove('text-slate-400', 'hover:bg-slate-50');
            listBtn.classList.remove('bg-indigo-50', 'text-indigo-600');
            listBtn.classList.add('text-slate-400', 'hover:bg-slate-50');
        } else {
            listBtn.classList.add('bg-indigo-50', 'text-indigo-600');
            listBtn.classList.remove('text-slate-400', 'hover:bg-slate-50');
            gridBtn.classList.remove('bg-indigo-50', 'text-indigo-600');
            gridBtn.classList.add('text-slate-400', 'hover:bg-slate-50');
        }
    }

    filterProducts(); // Re-render with new view mode
}

function renderProductGrid(products) {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    grid.innerHTML = '';
    if (products.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-12 text-slate-400">
                <i data-lucide="search-x" class="w-12 h-12 mb-3 opacity-20"></i>
                <p>No products found matching your search</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    if (posViewMode === 'grid') {
        grid.className = "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-1";
    } else {
        grid.className = "flex flex-col gap-2 p-1";
    }

    products.forEach(product => {
        const card = document.createElement('div');
        const stockColor = product.stock <= (product.lowStockThreshold || 3) ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-600';

        if (posViewMode === 'grid') {
            card.className = "bg-white rounded-xl shadow-sm border border-slate-200 p-3 cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all group flex flex-col h-full relative overflow-hidden";

            let imageHtml = product.image ?
                `<img src="${product.image}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">` :
                `<i data-lucide="package" class="w-10 h-10 text-slate-200"></i>`;

            card.innerHTML = `
                <div class="aspect-square rounded-lg bg-slate-50 mb-3 overflow-hidden flex items-center justify-center relative">
                    ${imageHtml}
                    ${product.stock <= (product.lowStockThreshold || 3) ? `<div class="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg animate-pulse">Low Stock</div>` : ''}
                </div>
                <div class="flex-1">
                    <p class="text-[10px] font-bold text-indigo-500 mb-0.5 uppercase tracking-wider">${product.category || 'General'}</p>
                    <h4 class="font-bold text-slate-800 text-sm leading-tight mb-1 line-clamp-2">${product.name}</h4>
                    <p class="text-[10px] font-medium text-slate-400 font-mono mb-2">${product.code}</p>
                </div>
                <div class="flex items-center justify-between mt-auto pt-2 border-t border-slate-50">
                    <p class="font-black text-indigo-600">Rs. ${parseFloat(product.retailPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    <div class="bg-indigo-50 text-indigo-600 p-1.5 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                    </div>
                </div>
            `;
        } else {
            // List View
            card.className = "bg-white rounded-lg shadow-sm border border-slate-200 p-2 cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all group flex items-center gap-4";

            let imageHtml = product.image ?
                `<img src="${product.image}" class="w-full h-full object-cover">` :
                `<i data-lucide="package" class="w-6 h-6 text-slate-200"></i>`;

            card.innerHTML = `
                <div class="w-12 h-12 rounded bg-slate-50 overflow-hidden flex items-center justify-center flex-shrink-0">
                    ${imageHtml}
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="font-bold text-slate-800 text-sm truncate uppercase tracking-tight">${product.name}</h4>
                    <div class="flex items-center gap-3">
                        <span class="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">${product.code}</span>
                        <span class="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">${product.category || 'General'}</span>
                    </div>
                </div>
                <div class="text-right flex items-center gap-6">
                    <div class="hidden sm:block">
                        <p class="text-[10px] ${product.stock <= (product.lowStockThreshold || 3) ? 'text-red-500 font-bold' : 'text-slate-400'}">Stock: ${product.stock}</p>
                    </div>
                    <p class="font-black text-indigo-600 min-w-[100px]">Rs. ${parseFloat(product.retailPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div class="bg-indigo-50 text-indigo-600 p-2 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <i data-lucide="plus" class="w-5 h-5"></i>
                </div>
            `;
        }

        card.onclick = () => addToCart(product);
        grid.appendChild(card);
    });
    if (window.lucide) lucide.createIcons();
}

function filterProducts() {
    const term = document.getElementById('pos-search').value.toLowerCase();
    const category = document.getElementById('pos-category-filter').value;

    const filtered = currentProducts.filter(p => {
        const termLower = term.toLowerCase();
        const matchesTerm = p.name.toLowerCase().includes(termLower) || (p.code && p.code.toLowerCase().includes(termLower));
        const matchesCategory = category === 'all' || p.category === category;
        return matchesTerm && matchesCategory;
    });

    renderProductGrid(filtered);
}

function addToCart(product) {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
        existing.qty++;
    } else {
        // Clone and add default discount from product
        cart.push({
            ...product,
            qty: 1,
            discountRate: product.discountType === 'fixed' ? 0 : (product.discountRate || 0),
            discountValue: product.discountType === 'fixed' ? (product.discountRate || 0) : 0,
            discountType: product.discountType || 'percent'
        });
    }
    updateCartUI();
}

function updateItemDiscount(id, val) {
    const item = cart.find(i => i.id === id);
    if (item) {
        if (item.discountType === 'fixed') {
            item.discountValue = parseFloat(val) || 0;
        } else {
            item.discountRate = parseFloat(val) || 0;
        }
        updateCartUI();
    }
}

function updateItemDiscountType(id, type) {
    const item = cart.find(i => i.id === id);
    if (item) {
        item.discountType = type;
        updateCartUI();
    }
}

function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    updateCartUI();
}

function updateCartItemQty(id, change) {
    const item = cart.find(i => i.id === id);
    if (!item) return;

    if (change > 0) {
        item.qty++;
    } else {
        item.qty--;
        if (item.qty <= 0) {
            removeFromCart(id);
            return;
        }
    }
    updateCartUI();
}

function clearCart() {
    cart = [];
    updateCartUI();
}

function updateCartUI() {
    const container = document.getElementById('cart-items');
    if (!container) return;
    container.innerHTML = '';

    let subtotal = 0;
    let totalItemDiscount = 0;

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-slate-400">
                <i data-lucide="shopping-basket" class="w-12 h-12 mb-2 opacity-50"></i>
                <p class="text-sm">Cart is empty</p>
            </div>`;
        if (window.lucide) lucide.createIcons();
    } else {
        cart.forEach(item => {
            const lineTotal = item.qty * item.retailPrice;
            let lineDiscount = 0;
            if (item.discountType === 'fixed') {
                lineDiscount = (item.discountValue || 0);
            } else {
                lineDiscount = lineTotal * ((item.discountRate || 0) / 100);
            }
            const netLineTotal = Math.max(0, lineTotal - lineDiscount);

            subtotal += lineTotal;
            totalItemDiscount += lineDiscount;

            const row = document.createElement('div');
            row.className = "flex flex-col gap-2 p-3 bg-white rounded-xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-colors";

            row.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="flex-1 min-w-0">
                        <p class="font-bold text-slate-800 text-sm truncate uppercase tracking-tight">${item.name}</p>
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">${item.code}</span>
                            <span class="text-[10px] font-bold text-indigo-600">Rs. ${parseFloat(item.retailPrice).toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-1 bg-slate-50 rounded-lg p-0.5 border border-slate-100">
                        <button onclick="updateCartItemQty(${item.id}, -1)" class="w-6 h-6 rounded-md hover:bg-white hover:shadow-sm text-slate-500 transition-all flex items-center justify-center font-bold">-</button>
                        <span class="text-xs font-bold w-5 text-center text-slate-700">${item.qty}</span>
                        <button onclick="updateCartItemQty(${item.id}, 1)" class="w-6 h-6 rounded-md hover:bg-white hover:shadow-sm text-slate-500 transition-all flex items-center justify-center font-bold">+</button>
                    </div>
                    <button onclick="removeFromCart(${item.id})" class="text-slate-300 hover:text-red-500 transition-colors">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </div>
                <div class="flex items-center justify-between text-[10px] border-t border-slate-50 pt-1">
                    <div class="flex items-center gap-2">
                        <span class="text-slate-400">Discount:</span>
                        <input type="number" value="${item.discountType === 'fixed' ? (item.discountValue || 0) : (item.discountRate || 0)}" min="0" 
                            class="w-12 px-1 border border-slate-100 rounded bg-slate-50 text-center outline-none focus:ring-1 focus:ring-indigo-300"
                            onchange="updateItemDiscount(${item.id}, this.value)">
                        <select onchange="updateItemDiscountType(${item.id}, this.value)" class="bg-transparent border-none p-0 text-indigo-600 font-bold focus:ring-0 cursor-pointer">
                            <option value="percent" ${item.discountType !== 'fixed' ? 'selected' : ''}>%</option>
                            <option value="fixed" ${item.discountType === 'fixed' ? 'selected' : ''}>Rs.</option>
                        </select>
                    </div>
                    <span class="text-slate-500 font-medium font-mono">Net: Rs. ${netLineTotal.toFixed(2)}</span>
                </div>
            `;
            container.appendChild(row);
        });
        if (window.lucide) lucide.createIcons();
    }

    const billDiscountType = document.getElementById('bill-discount-type')?.value || 'percent';
    const billDiscountInput = parseFloat(document.getElementById('bill-discount-input')?.value || 0);
    const afterItemDiscount = subtotal - totalItemDiscount;

    let billDiscountAmount = 0;
    if (billDiscountType === 'fixed') {
        billDiscountAmount = billDiscountInput;
    } else {
        billDiscountAmount = afterItemDiscount * (billDiscountInput / 100);
    }

    const finalTotal = Math.max(0, afterItemDiscount - billDiscountAmount);
    const totalDiscount = totalItemDiscount + billDiscountAmount;

    const subtotalEl = document.getElementById('cart-subtotal');
    const totalEl = document.getElementById('cart-total');
    const discountEl = document.getElementById('cart-discount');
    const checkoutBtn = document.getElementById('checkout-btn');

    if (subtotalEl) subtotalEl.textContent = `Rs. ${subtotal.toFixed(2)}`;
    if (discountEl) discountEl.textContent = `- Rs. ${totalDiscount.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `Rs. ${finalTotal.toFixed(2)}`;
    if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;

    // Update Mobile Cart Badge
    const badge = document.getElementById('cart-count-badge');
    if (badge) {
        const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
        badge.textContent = totalItems;
        if (totalItems > 0) {
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

function openPaymentModal() {
    if (cart.length === 0) {
        alert("Your cart is empty! Please add products before paying.");
        return;
    }

    const billDiscountType = document.getElementById('bill-discount-type')?.value || 'percent';
    const billDiscountInput = parseFloat(document.getElementById('bill-discount-input')?.value || 0);

    const subtotal = cart.reduce((sum, item) => sum + (item.qty * item.retailPrice), 0);
    const itemDiscounts = cart.reduce((sum, item) => {
        const lineTotal = item.qty * item.retailPrice;
        if (item.discountType === 'fixed') return sum + (item.discountValue || 0);
        return sum + (lineTotal * ((item.discountRate || 0) / 100));
    }, 0);

    const afterItemDiscount = subtotal - itemDiscounts;
    let billDiscountAmount = 0;
    if (billDiscountType === 'fixed') {
        billDiscountAmount = billDiscountInput;
    } else {
        billDiscountAmount = afterItemDiscount * (billDiscountInput / 100);
    }

    const totalAmount = Math.max(0, afterItemDiscount - billDiscountAmount);

    const totalEl = document.getElementById('payment-total-display');
    const cashInput = document.getElementById('payment-cash');
    const balanceEl = document.getElementById('payment-balance-display');
    const modal = document.getElementById('payment-modal');

    if (totalEl) totalEl.textContent = `Rs. ${totalAmount.toFixed(2)}`;
    if (cashInput) cashInput.value = '';
    if (balanceEl) balanceEl.textContent = 'Rs. 0.00';

    if (modal) {
        modal.classList.remove('hidden');
        // Reset new fields
        const methodSelect = document.getElementById('payment-method');
        if (methodSelect) methodSelect.value = 'Cash';
        const custName = document.getElementById('payment-customer-name');
        if (custName) custName.value = '';
        const custPhone = document.getElementById('payment-customer-phone');
        if (custPhone) custPhone.value = '';

        togglePaymentFields(); // Ensure fields are correctly shown/hidden

        if (cashInput) setTimeout(() => cashInput.focus(), 100);
    }
}

function togglePaymentFields() {
    const method = document.getElementById('payment-method')?.value;
    const cashFields = document.getElementById('cash-payment-fields');
    const confirmBtn = document.getElementById('confirm-payment-btn');

    if (method === 'Credit') {
        if (cashFields) cashFields.classList.add('hidden');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    } else {
        if (cashFields) cashFields.classList.remove('hidden');
        updatePaymentBalance(); // Re-validate cash
    }
}
window.togglePaymentFields = togglePaymentFields;


function updatePaymentBalance() {
    const billDiscountType = document.getElementById('bill-discount-type')?.value || 'percent';
    const billDiscountInput = parseFloat(document.getElementById('bill-discount-input')?.value || 0);

    const subtotal = cart.reduce((sum, item) => sum + (item.qty * item.retailPrice), 0);
    const itemDiscounts = cart.reduce((sum, item) => {
        const lineTotal = item.qty * item.retailPrice;
        if (item.discountType === 'fixed') return sum + (item.discountValue || 0);
        return sum + (lineTotal * ((item.discountRate || 0) / 100));
    }, 0);

    const afterItemDiscount = subtotal - itemDiscounts;
    let billDiscountAmount = 0;
    if (billDiscountType === 'fixed') {
        billDiscountAmount = billDiscountInput;
    } else {
        billDiscountAmount = afterItemDiscount * (billDiscountInput / 100);
    }

    const totalAmount = Math.max(0, afterItemDiscount - billDiscountAmount);

    const cashInput = document.getElementById('payment-cash');
    const cash = parseFloat(cashInput ? cashInput.value : 0) || 0;
    const balance = cash - totalAmount;
    const balanceEl = document.getElementById('payment-balance-display');
    const confirmBtn = document.getElementById('confirm-payment-btn');

    if (balanceEl) balanceEl.textContent = `Rs. ${balance.toFixed(2)}`;

    if (balanceEl && confirmBtn) {
        if (balance < 0) {
            balanceEl.className = "text-xl font-bold text-red-600";
            confirmBtn.disabled = true;
            confirmBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            balanceEl.className = "text-xl font-bold text-green-700";
            confirmBtn.disabled = false;
            confirmBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
}

async function finalizeSale() {
    if (cart.length === 0) return;

    const billDiscountType = document.getElementById('bill-discount-type')?.value || 'percent';
    const billDiscountInput = parseFloat(document.getElementById('bill-discount-input')?.value || 0);

    const subtotal = cart.reduce((sum, item) => sum + (item.qty * item.retailPrice), 0);
    const itemDiscounts = cart.reduce((sum, item) => {
        const lineTotal = item.qty * item.retailPrice;
        if (item.discountType === 'fixed') return sum + (item.discountValue || 0);
        return sum + (lineTotal * ((item.discountRate || 0) / 100));
    }, 0);

    const afterItemDiscount = subtotal - itemDiscounts;
    let billDiscountAmount = 0;
    if (billDiscountType === 'fixed') {
        billDiscountAmount = billDiscountInput;
    } else {
        billDiscountAmount = afterItemDiscount * (billDiscountInput / 100);
    }

    const totalAmount = Math.max(0, afterItemDiscount - billDiscountAmount);

    const totalProfit = cart.reduce((sum, item) => {
        let itemRevenue = 0;
        if (item.discountType === 'fixed') {
            itemRevenue = Math.max(0, (item.qty * item.retailPrice) - (item.discountValue || 0));
        } else {
            itemRevenue = (item.qty * item.retailPrice * (1 - ((item.discountRate || 0) / 100)));
        }
        return sum + (itemRevenue - (item.costPrice * item.qty));
    }, 0);

    // Apply global discount proportionally to profit? 
    // Actually, it's simpler to just subtract the bill discount from the total profit.
    const finalTotalProfit = Math.max(0, totalProfit - billDiscountAmount);

    const cashInput = document.getElementById('payment-cash');
    const cashReceived = parseFloat(cashInput ? cashInput.value : 0) || 0;
    const paymentMethod = document.getElementById('payment-method')?.value || 'Cash';
    const customerName = document.getElementById('payment-customer-name')?.value.trim() || 'Anonymous';
    const customerPhone = document.getElementById('payment-customer-phone')?.value.trim() || '';

    if (paymentMethod === 'Cash' && cashReceived < totalAmount) {
        alert("Insufficient Cash!");
        return;
    }

    const sale = {
        timestamp: new Date().toISOString(),
        items: cart.map(i => ({
            id: i.id,
            code: i.code,
            name: i.name,
            qty: i.qty,
            price: i.retailPrice,
            cost: i.costPrice,
            discountRate: i.discountType === 'percent' ? (i.discountRate || 0) : 0,
            discountValue: i.discountType === 'fixed' ? (i.discountValue || 0) : 0,
            discountType: i.discountType || 'percent'
        })),
        subtotal: subtotal,
        totalAmount: totalAmount,
        totalProfit: finalTotalProfit,
        billDiscountRate: billDiscountType === 'percent' ? billDiscountInput : 0,
        billDiscountValue: billDiscountType === 'fixed' ? billDiscountInput : 0,
        billDiscountType: billDiscountType,
        payment: {
            cash: paymentMethod === 'Credit' ? 0 : cashReceived,
            balance: paymentMethod === 'Credit' ? 0 : (cashReceived - totalAmount)
        },
        paymentMethod: paymentMethod,
        paymentStatus: paymentMethod === 'Credit' ? 'Credit' : 'Paid',
        customerName: customerName,
        customerPhone: customerPhone
    };

    try {
        const saleId = await recordSale(sale);

        for (const item of cart) {
            await decreaseStock(item.id, item.qty);
        }

        generateReceipt(sale, formatID(saleId, 'INV'));
        lastSale = { ...sale, id: saleId };

        // Refresh sales history if we are in that view (though usually we are in POS)
        salesCurrentPage = 1;
        loadSalesHistory();

        const formattedSaleId = formatID(saleId, 'INV');

        closePaymentModal();
        const successModal = document.getElementById('success-modal');
        if (successModal) {
            successModal.classList.remove('hidden');
            if (window.lucide) lucide.createIcons();

            // Inject Receipt Preview
            const previewContainer = document.getElementById('receipt-preview-container');
            if (previewContainer) {
                previewContainer.innerHTML = generateReceiptHTML(sale, formattedSaleId);
            }

            // Auto-focus the print button so another 'Enter' prints it
            const printBtn = document.getElementById('print-receipt-btn');
            if (printBtn) setTimeout(() => printBtn.focus(), 200);
        }

        clearCart();
        loadProducts();

    } catch (error) {
        console.error("Checkout failed:", error);
        alert("Transaction failed. Please try again or check console.");
    }
}

// --- Receipt System ---

function formatID(id, prefix) {
    return `${prefix}-${id.toString().padStart(8, '0')}`;
}

function generateReceipt(sale, formattedId) {
    const printContainer = document.getElementById('print-container');
    if (!printContainer) {
        console.error("Print container not found");
        return;
    }

    const receiptHtml = generateReceiptHTML(sale, formattedId);

    // Move print styling to a separate function to avoid pollution
    const printBtn = document.getElementById('print-receipt-btn');
    if (printBtn) {
        printBtn.onclick = () => {
            // Inject temporary print style to head
            const styleId = 'print-temp-style';
            let style = document.getElementById(styleId);
            if (!style) {
                style = document.createElement('style');
                style.id = styleId;
                document.head.appendChild(style);
            }
            style.innerHTML = `
                @media print {
                    @page { size: 80mm auto; margin: 0; }
                    body { margin: 0 !important; padding: 0 !important; overflow: visible !important; height: auto !important; }
                    body > *:not(#print-container) { display: none !important; }
                    #print-container { display: block !important; visibility: visible !important; width: 80mm !important; margin: 0 !important; padding: 0 !important; }
                }
            `;

            window.print();

            // Cleanup
            if (style) style.remove();
            printContainer.innerHTML = '';
            closeSuccessModal();
        };
    }

    printContainer.innerHTML = receiptHtml;
}

function generateReceiptHTML(sale, formattedId) {
    const date = new Date(sale.timestamp).toLocaleString();

    let itemsHtml = '';
    sale.items.forEach(item => {
        const itemTotal = item.qty * item.price;
        const itemDiscount = item.discountType === 'fixed' ? (item.discountValue || 0) : (itemTotal * ((item.discountRate || 0) / 100));
        const discLabel = item.discountType === 'fixed' ? `(Rs. ${parseFloat(item.discountValue || 0).toFixed(2)})` : `(-${item.discountRate}%)`;

        itemsHtml += `
            <div style="margin-bottom: 6px; font-size: 13px;">
                <div style="display: flex; justify-content: space-between;">
                    <div style="font-weight: 600;">${item.name} <span style="font-size: 10px; font-weight: normal; color: #444;">(${item.code || '-'})</span></div>
                    <div style="font-weight: 600;">${itemTotal.toFixed(2)}</div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: #444;">
                    <span>${item.qty} x ${parseFloat(item.price).toFixed(2)}</span>
                    ${itemDiscount > 0 ? `<span style="color: #000;">${discLabel} -${itemDiscount.toFixed(2)}</span>` : ''}
                </div>
            </div>
        `;
    });

    const totalDiscountAmount = (sale.subtotal || 0) - sale.totalAmount;

    return `
        <div style="font-family: 'Courier Prime', monospace; color: #000; width: 100%; max-width: 72mm; margin: 0 auto; padding: 5mm; background: white;">
            
    <!-- Header -->
    <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 12px; margin-bottom: 16px;">
        <h1 style="font-size: 28px; font-weight: 900; margin: 0; word-spacing: -2px;">SK MART TRADING</h1>
        <p style="font-size: 12px; margin: 1px 0; font-style: italic; margin-bottom: 12px;">For Home. For Care. For You.</p>
        <p style="font-size: 14px; margin: 2px 0;">601/2 Nindahena, Gothatuwa</p>
        <p style="font-size: 14px; margin: 2px 0;">TEL: 0112 119 438</p>
    </div>

    <!-- Meta -->
    <div style="font-size: 14px; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; font-weight:400;">
            <span>Date:</span>
            <span>${date}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight:400;">
            <span>Inv #:</span>
            <span>${formattedId}</span>
        </div>
    </div>

    <div style="border-bottom: 1px dashed #000; margin-bottom: 10px;"></div>

    <!-- Items -->
    <div style="margin-bottom: 10px;">
        ${itemsHtml}
    </div>

    <div style="border-bottom: 1px dashed #000; margin-bottom: 10px;"></div>

    <!-- Summary -->
    <div style="margin-bottom: 15px;">
        <div style="display: flex; justify-content: space-between; font-size: 14px;">
            <span>Subtotal</span>
            <span>Rs. ${(sale.subtotal || sale.totalAmount).toFixed(2)}</span>
        </div>

        ${sale.billDiscountType === 'fixed' ? `
        <div style="display: flex; justify-content: space-between; font-size: 14px;">
            <span>Bill Discount (Fixed)</span>
            <span>- Rs. ${parseFloat(sale.billDiscountValue || 0).toFixed(2)}</span>
        </div>` :
            (sale.billDiscountRate > 0 ? `
        <div style="display: flex; justify-content: space-between; font-size: 14px;">
            <span>Bill Discount (${sale.billDiscountRate}%)</span>
            <span>- Rs. ${totalDiscountAmount.toFixed(2)}</span>
        </div>` : '')}

        <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 22px; margin-top: 5px; margin-bottom: 5px; border-top: 1px solid #000; padding-top: 15px;">
            <span>TOTAL</span>
            <span>Rs. ${sale.totalAmount.toFixed(2)}</span>
        </div>

        ${sale.paymentStatus === 'Credit' ? `
        <div style="text-align: center; margin: 10px 0; border: 2px solid #000; padding: 5px; font-weight: 900; font-size: 16px;">
            CREDIT
        </div>
        <div style="font-size: 14px; margin-bottom: 5px;">
            <div>Customer: ${sale.customerName}</div>
            ${sale.customerPhone ? `<div>Phone: ${sale.customerPhone}</div>` : ''}
        </div>
        ` : `
        <div style="display: flex; justify-content: space-between; font-size: 14px;">
            <span>Cash</span>
            <span>Rs. ${sale.payment.cash.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 14px;">
            <span>Balance</span>
            <span>Rs. ${sale.payment.balance.toFixed(2)}</span>
        </div>
        `}
    </div>

    <!-- Footer -->
    <div style="text-align: center; border-top: 1px dashed #000; padding-top: 14px; font-size: 14px;">
        <p style="font-weight: 700; margin: 0;">THANK YOU FOR SHOPPING!</p>
        <p style="margin: 8px 0;">Please come again.</p>
        <p style="font-size: 12px;">Software by SAILY</p>
    </div>

</div>
    `;
}

function closeSuccessModal() {
    const modal = document.getElementById('success-modal');
    if (modal) modal.classList.add('hidden');

    // Focus terminal for next sale
    const terminal = document.getElementById('pos-terminal-input');
    if (terminal) terminal.focus();
    else {
        const search = document.getElementById('pos-search');
        if (search) search.focus();
    }
}

function closePaymentModal() {
    const modal = document.getElementById('payment-modal');
    if (modal) modal.classList.add('hidden');

    const terminal = document.getElementById('pos-terminal-input');
    if (terminal) terminal.focus();
    else {
        const search = document.getElementById('pos-search');
        if (search) search.focus();
    }
}



// --- Inventory Management ---

async function loadInventoryTable() {
    try {
        if (typeof getAllProducts !== 'function') return;
        const products = await getAllProducts();

        const tbody = document.getElementById('inventory-table-body');
        if (!tbody) return;

        const searchInput = document.getElementById('inventory-search');
        const filterInput = document.getElementById('inventory-filter');

        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const filterType = filterInput ? filterInput.value : 'all';

        tbody.innerHTML = '';

        products.forEach(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm) || (p.code && p.code.toLowerCase().includes(searchTerm));
            if (!matchesSearch) return;

            const threshold = p.lowStockThreshold || 3;
            if (filterType === 'low-stock' && p.stock > threshold) return;

            const row = document.createElement('tr');
            row.className = "hover:bg-slate-50 border-b border-slate-100 items-center";

            let imageTag = '';
            if (p.image) {
                imageTag = `<img src="${p.image}" class="w-10 h-10 object-cover rounded-md shadow-sm border border-slate-200">`;
            } else {
                imageTag = `<div class="w-10 h-10 bg-slate-100 rounded-md flex items-center justify-center text-slate-300 border border-slate-100">
                                <i data-lucide="image" class="w-5 h-5"></i>
                            </div>`;
            }

            row.innerHTML = `
                <td class="p-4">${imageTag}</td>
                <td class="p-4 font-mono text-xs text-slate-500">${p.code || '-'}</td>
                <td class="p-4 font-medium text-slate-800">${p.name}</td>
                <td class="p-4 text-slate-500 text-sm">${p.category}</td>
                <td class="p-4 text-right text-slate-600 font-mono text-sm">${parseFloat(p.costPrice).toFixed(2)}</td>
                <td class="p-4 text-right text-indigo-600 font-mono font-medium text-sm">${parseFloat(p.retailPrice).toFixed(2)}</td>
                <td class="p-4 text-center">
                    <span class="px-2 py-1 rounded-full text-xs font-bold ${p.stock <= threshold ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}">
                        ${p.stock}
                    </span>
                </td>
                <td class="p-4 text-center">
                    <div class="flex items-center justify-center gap-1">
                        <button onclick="editProduct(${p.id})" class="text-indigo-600 hover:text-indigo-800 p-1"><i data-lucide="edit-2" class="w-4 h-4"></i></button>
                        <button onclick="confirmDeleteProduct(${p.id})" class="text-red-500 hover:text-red-700 p-1"><i data-lucide="trash" class="w-4 h-4"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        console.error("Error loading inventory:", e);
    }
}


function openProductModal() {
    const form = document.getElementById('product-form');
    if (form) form.reset();
    currentProductImage = null;
    updateImagePreview(null);
    const fileArg = document.getElementById('product-image');
    if (fileArg) fileArg.value = ''; // Clear file input

    document.getElementById('product-id').value = '';
    document.getElementById('modal-title').textContent = 'Add New Product';
    document.getElementById('product-modal').classList.remove('hidden');
    setTimeout(() => {
        document.getElementById('product-modal-content').classList.remove('scale-95', 'opacity-0');
        document.getElementById('product-modal-content').classList.add('scale-100', 'opacity-100');
    }, 10);
    // Set default value for new products
    document.getElementById('low-stock-threshold').value = '3';
    document.getElementById('product-discount').value = '0';

    // Auto-populate next product code
    generateNextProductCode();
}

async function generateNextProductCode() {
    try {
        const products = await getAllProducts();
        let maxId = 0;
        products.forEach(p => {
            if (p.code && p.code.startsWith('PRD-')) {
                const num = parseInt(p.code.split('-')[1]);
                if (!isNaN(num) && num > maxId) maxId = num;
            }
        });
        document.getElementById('product-code').value = formatID(maxId + 1, 'PRD');
    } catch (e) {
        console.error("Error generating product code:", e);
    }
}

function closeProductModal() {
    document.getElementById('product-modal-content').classList.remove('scale-100', 'opacity-100');
    document.getElementById('product-modal-content').classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        document.getElementById('product-modal').classList.add('hidden');
    }, 200);
}

const readFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
});

function updateImagePreview(src) {
    const preview = document.getElementById('image-preview');
    if (!preview) return;

    if (src) {
        preview.innerHTML = `<img src="${src}" class="w-full h-full object-cover">
                             <button type="button" onclick="event.stopPropagation(); updateImagePreview(null); document.getElementById('product-image').value=''; currentProductImage=null;" 
                                     class="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600 transition-colors">
                                <i data-lucide="x" class="w-4 h-4"></i>
                             </button>`;
        if (window.lucide) lucide.createIcons();
    } else {
        preview.innerHTML = `<div class="text-center p-4">
                                <i data-lucide="image-plus" class="w-10 h-10 mx-auto text-slate-300 group-hover:text-indigo-400 transition-colors"></i>
                                <p class="mt-2 text-xs text-slate-400">Click to upload or <br><strong>Paste image (Ctrl+V)</strong></p>
                             </div>`;
        if (window.lucide) lucide.createIcons();
    }
}

async function handleProductSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('product-id').value;
    let image = currentProductImage;

    try {

        // Keep existing image if no new one provided during edit
        if (id && !image) {
            const oldProduct = await getProductById(parseInt(id));
            if (oldProduct) image = oldProduct.image;
        }

        const product = {
            code: document.getElementById('product-code').value.trim(),
            name: document.getElementById('product-name').value,
            category: document.getElementById('product-category').value,
            costPrice: parseFloat(document.getElementById('product-cost').value),
            retailPrice: parseFloat(document.getElementById('product-price').value),
            discountRate: parseFloat(document.getElementById('product-discount').value) || 0,
            discountType: document.getElementById('product-discount-type').value || 'percent',
            stock: parseInt(document.getElementById('product-stock').value),
            lowStockThreshold: parseInt(document.getElementById('low-stock-threshold').value) || 3,
            image: image // Store base64 string
        };

        // Uniqueness Check for Code
        const allProducts = await getAllProducts();
        const codeExists = allProducts.some(p => p.code === product.code && p.id !== parseInt(id));

        if (codeExists) {
            alert(`Product code "${product.code}" already exists in the database. Please use a unique code.`);
            return;
        }

        if (id) {
            await updateProduct(parseInt(id), product);
        } else {
            await addProduct(product);
        }

        closeProductModal();
        loadInventoryTable();
        loadProducts(); // Update POS grid too
    } catch (error) {
        console.error("Error saving product:", error);
        alert("Failed to save product (Image might be too large)");
    }
}

async function editProduct(id) {
    const product = await getProductById(id);
    if (!product) return;

    document.getElementById('product-id').value = product.id;
    document.getElementById('product-code').value = product.code || '';
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-category').value = product.category;
    document.getElementById('product-cost').value = product.costPrice;
    document.getElementById('product-price').value = product.retailPrice;
    document.getElementById('product-discount').value = product.discountRate || 0;
    document.getElementById('product-discount-type').value = product.discountType || 'percent';
    document.getElementById('product-stock').value = product.stock;
    document.getElementById('low-stock-threshold').value = product.lowStockThreshold || 3;

    currentProductImage = product.image;
    updateImagePreview(currentProductImage);

    document.getElementById('modal-title').textContent = 'Edit Product';
    document.getElementById('product-modal').classList.remove('hidden');
    setTimeout(() => {
        document.getElementById('product-modal-content').classList.remove('scale-95', 'opacity-0');
        document.getElementById('product-modal-content').classList.add('scale-100', 'opacity-100');
    }, 10);
}

async function confirmDeleteProduct(id) {
    if (confirm("Are you sure you want to delete this product?")) {
        await deleteProduct(id);
        loadInventoryTable();
        loadProducts();
    }
}

// --- Sales History ---
async function clearSalesHistory() {
    if (confirm("Are you sure you want to delete ALL sales history? This cannot be undone.")) {
        try {
            await deleteAllSalesHistory(); // New name from db.js
            loadSalesHistory();
            updateReports();
            alert("Sales history cleared.");
        } catch (e) {
            console.error("Error clearing sales:", e);
        }
    }
}

async function loadSalesHistory() {
    try {
        if (typeof getAllSales !== 'function') return;
        const sales = await getAllSales();
        const tbody = document.getElementById('sales-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        // Filter Logic
        const dateInput = document.getElementById('sales-filter-date');
        const filterDate = dateInput ? dateInput.value : '';
        const searchInput = document.getElementById('sales-search');
        const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';

        let filteredSales = sales;

        // Apply Date Filter
        if (filterDate) {
            const [y, m, d] = filterDate.split('-');
            const filterDateStr = new Date(y, m - 1, d).toDateString();
            filteredSales = filteredSales.filter(s => new Date(s.timestamp).toDateString() === filterDateStr);
        }

        // Apply Search Filter
        if (searchQuery) {
            filteredSales = filteredSales.filter(s => {
                const invId = formatID(s.id, 'INV').toLowerCase();
                const customer = (s.customerName || '').toLowerCase();
                const phone = (s.customerPhone || '').toLowerCase();
                return invId.includes(searchQuery) || customer.includes(searchQuery) || phone.includes(searchQuery);
            });
        }

        // Pagination
        const totalEntries = filteredSales.length;
        const totalPages = Math.ceil(totalEntries / salesItemsPerPage);

        // Adjust current page if out of bounds
        if (salesCurrentPage > totalPages) salesCurrentPage = Math.max(1, totalPages);

        const startIndex = (salesCurrentPage - 1) * salesItemsPerPage;
        const endIndex = Math.min(startIndex + salesItemsPerPage, totalEntries);
        const pageSales = filteredSales.slice(startIndex, endIndex);

        let totalAmount = 0;
        let totalProfit = 0;

        // Calculate totals based on FILTERED sales (all, not just current page)
        filteredSales.forEach(s => {
            totalAmount += s.totalAmount;
            totalProfit += s.totalProfit;
        });

        pageSales.forEach(sale => {
            const isCredit = sale.paymentStatus === 'Credit';
            const statusClass = isCredit ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';

            const row = document.createElement('tr');
            row.className = "hover:bg-slate-50 border-b border-slate-100";
            row.innerHTML = `
                <td class="p-4 text-slate-600 text-sm font-medium">${new Date(sale.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                <td class="p-4 font-mono text-sm text-slate-500">${formatID(sale.id, 'INV')}</td>
                <td class="p-4 text-sm font-medium text-slate-700">${sale.customerName || 'Anonymous'}</td>
                <td class="p-4">
                    <span class="text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${statusClass}">
                        ${sale.paymentStatus || 'Paid'}
                    </span>
                </td>
                <td class="p-4 text-right font-bold text-slate-800">Rs. ${sale.totalAmount.toFixed(2)}</td>
                <td class="p-4 text-right text-green-600 text-sm font-bold">+ ${sale.totalProfit.toFixed(2)}</td>
                <td class="p-4 text-right text-slate-600 text-xs">Rs. ${(sale.payment?.cash || 0).toFixed(2)}</td>
                <td class="p-4 text-right text-slate-600 text-xs">Rs. ${(sale.payment?.balance || 0).toFixed(2)}</td>
                <td class="p-4 text-center">
                     <span class="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500">${sale.items.length} items</span>
                </td>
                <td class="p-4 text-center">
                    <div class="flex items-center justify-center gap-1">
                        <button onclick="viewSaleDetails(${sale.id})" class="text-indigo-600 hover:text-indigo-800 p-1 flex items-center justify-center" title="View Details">
                            <i data-lucide="eye" class="w-4 h-4"></i>
                        </button>
                        <button onclick="printSale(${sale.id})" class="text-slate-500 hover:text-indigo-600 p-1 flex items-center justify-center" title="Print Receipt">
                            <i data-lucide="printer" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.append(row);
        });

        // Update Totals
        const footerAmount = document.getElementById('sales-footer-amount');
        const footerProfit = document.getElementById('sales-footer-profit');
        if (footerAmount) footerAmount.textContent = `Rs. ${totalAmount.toFixed(2)}`;
        if (footerProfit) footerProfit.textContent = `Rs. ${totalProfit.toFixed(2)}`;

        // Update Pagination Info
        const infoEl = document.getElementById('sales-pagination-info');
        if (infoEl) {
            infoEl.textContent = totalEntries > 0
                ? `Showing ${startIndex + 1} to ${endIndex} of ${totalEntries} entries`
                : 'No entries to show';
        }

        const prevBtn = document.getElementById('sales-prev-btn');
        const nextBtn = document.getElementById('sales-next-btn');
        if (prevBtn) prevBtn.disabled = salesCurrentPage === 1;
        if (nextBtn) nextBtn.disabled = salesCurrentPage >= totalPages;

        if (window.lucide) lucide.createIcons();
    } catch (e) {
        console.error("Error loading sales history:", e);
    }
}

function previousSalesPage() {
    if (salesCurrentPage > 1) {
        salesCurrentPage--;
        loadSalesHistory();
    }
}

function nextSalesPage() {
    salesCurrentPage++;
    loadSalesHistory();
}

async function exportSalesToExcel() {
    try {
        const sales = await getAllSales();
        if (!sales || sales.length === 0) {
            alert("No sales to export");
            return;
        }

        // Create CSV Header
        let csv = "Date,Invoice ID,Customer,Phone,Method,Status,Subtotal,Total Amount,Profit,Items Count\n";

        sales.forEach(s => {
            const date = new Date(s.timestamp).toLocaleString().replace(/,/g, '');
            const invId = formatID(s.id, 'INV');
            const customer = (s.customerName || 'Anonymous').replace(/,/g, '');
            const phone = (s.customerPhone || '').replace(/,/g, '');
            const method = s.paymentMethod || 'Cash';
            const status = s.paymentStatus || 'Paid';
            const subtotal = s.subtotal || 0;
            const total = s.totalAmount || 0;
            const profit = s.totalProfit || 0;
            const items = s.items.length;

            csv += `${date},${invId},${customer},${phone},${method},${status},${subtotal},${total},${profit},${items}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `Sales_History_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (e) {
        console.error("Export failed:", e);
        alert("Export failed");
    }
}

async function viewSaleDetails(id) {
    try {
        const sale = await getSaleById(id);
        if (!sale) return;

        document.getElementById('detail-date-id').textContent = `${formatID(sale.id, 'INV')} • ${new Date(sale.timestamp).toLocaleString()}`;

        const tbody = document.getElementById('detail-items-list');
        tbody.innerHTML = '';

        sale.items.forEach((item, index) => {
            const row = document.createElement('tr');
            row.className = "border-b border-slate-50";

            row.innerHTML = `
                <td class="p-3 text-sm text-slate-500 font-mono">${item.code || '-'}</td>
                <td class="p-3">
                    <p class="font-medium text-slate-800">${item.name}</p>
                </td>
                <td class="p-3 text-right text-slate-600">Rs. ${parseFloat(item.price).toFixed(2)}</td>
                <td class="p-3 text-center text-slate-800 font-medium">${item.qty}</td>
                <td class="p-3 text-right text-slate-800 font-medium">Rs. ${(item.price * item.qty).toFixed(2)}</td>
                <td class="p-3 text-center">
                    <button onclick="initiateReturn(${sale.id}, ${index})" class="text-red-500 hover:text-red-700 text-xs font-medium px-2 py-1 border border-red-200 rounded hover:bg-red-50 transition-colors">
                        Return
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

        const totalDiscount = (sale.subtotal || 0) - sale.totalAmount;
        document.getElementById('detail-subtotal').textContent = `Rs. ${(sale.subtotal || sale.totalAmount).toFixed(2)}`;

        // Show bill discount if any
        let discountHtml = '';
        if (sale.billDiscountType === 'fixed' && (sale.billDiscountValue || 0) > 0) {
            discountHtml = `<div class="flex justify-between text-xs text-green-600"><span>Bill Discount (Fixed):</span><span>- Rs. ${parseFloat(sale.billDiscountValue).toFixed(2)}</span></div>`;
        } else if (sale.billDiscountRate > 0) {
            discountHtml = `<div class="flex justify-between text-xs text-green-600"><span>Bill Discount (${sale.billDiscountRate}%):</span><span>- Rs. ${totalDiscount.toFixed(2)}</span></div>`;
        }

        const subtotalBox = document.getElementById('detail-subtotal').parentElement;
        // Remove old discount display if exists to avoid duplication
        const oldDisc = subtotalBox.parentElement.querySelector('.detail-discount-info');
        if (oldDisc) oldDisc.remove();

        if (discountHtml) {
            const div = document.createElement('div');
            div.className = 'detail-discount-info';
            div.innerHTML = discountHtml;
            subtotalBox.insertAdjacentElement('afterend', div);
        }

        document.getElementById('detail-total').textContent = `Rs. ${sale.totalAmount.toFixed(2)}`;
        document.getElementById('detail-profit').textContent = `Rs. ${sale.totalProfit.toFixed(2)}`;

        // Customer & Status
        const statusEl = document.getElementById('detail-status');
        const methodEl = document.getElementById('detail-method');
        const customerBox = document.getElementById('detail-customer-box');
        const markPaidBtn = document.getElementById('mark-paid-btn');

        if (statusEl) {
            statusEl.textContent = sale.paymentStatus || 'Paid';
            statusEl.className = sale.paymentStatus === 'Credit' ? 'font-bold text-amber-600' : 'font-bold text-green-600';
        }
        if (methodEl) methodEl.textContent = sale.paymentMethod || 'Cash';

        if (customerBox) {
            if (sale.customerName || sale.customerPhone) {
                customerBox.classList.remove('hidden');
                document.getElementById('detail-customer-name').textContent = sale.customerName || '-';
                document.getElementById('detail-customer-phone').textContent = sale.customerPhone || '-';
            } else {
                customerBox.classList.add('hidden');
            }
        }

        if (markPaidBtn) {
            if (sale.paymentStatus === 'Credit') {
                markPaidBtn.classList.remove('hidden');
                markPaidBtn.onclick = () => markSaleAsPaid(sale.id);
            } else {
                markPaidBtn.classList.add('hidden');
            }
        }

        const cash = sale.payment?.cash || 0;
        const balance = sale.payment?.balance || 0;

        document.getElementById('detail-cash').textContent = `Rs. ${cash.toFixed(2)}`;
        document.getElementById('detail-balance').textContent = `Rs. ${balance.toFixed(2)}`;

        const modal = document.getElementById('sale-detail-modal');
        if (modal) {
            // Setup Full Return Button
            const returnBtn = document.getElementById('return-full-bill-btn');
            if (returnBtn) {
                returnBtn.onclick = () => returnFullBill(sale.id);
                // Hide button if bill is already empty/returned
                returnBtn.style.display = sale.items.length === 0 ? 'none' : 'flex';
            }

            modal.classList.remove('hidden');
            // Animate in
            const content = document.getElementById('sale-detail-content');
            if (content) {
                content.classList.remove('scale-95', 'opacity-0');
                content.classList.add('scale-100', 'opacity-100');
            }
        }

    } catch (e) {
        console.error("Error viewing sale:", e);
    }
}

async function markSaleAsPaid(id) {
    if (!confirm("Confirm that this credit sale has been fully paid in cash?")) return;

    try {
        const sale = await getSaleById(id);
        if (!sale) return;

        sale.paymentStatus = 'Paid';
        sale.paymentMethod = 'Cash';
        sale.payment = {
            cash: sale.totalAmount,
            balance: 0
        };

        await updateSale(id, sale);
        alert("Transaction marked as PAID!");
        closeSaleDetailModal();
        loadSalesHistory();
        updateReports();
    } catch (e) {
        console.error("Error marking as paid:", e);
        alert("Operation failed");
    }
}

function closeSaleDetailModal() {
    const modal = document.getElementById('sale-detail-modal');
    if (modal) modal.classList.add('hidden');
}

async function initiateReturn(saleId, itemIndex) {
    const qtyStr = prompt("Enter quantity to return:");
    if (!qtyStr) return;

    const qty = parseInt(qtyStr);
    if (isNaN(qty) || qty <= 0) {
        alert("Invalid quantity");
        return;
    }

    await processReturn(saleId, itemIndex, qty);
}

async function processReturn(saleId, itemIndex, returnQty) {
    try {
        const sale = await getSaleById(saleId);
        if (!sale) return;

        const item = sale.items[itemIndex];

        if (returnQty > item.qty) {
            alert("Cannot return more than purchased quantity");
            return;
        }

        if (!confirm(`Confirm return of ${returnQty} x ${item.name}? Stock will be updated.`)) return;

        // 1. Update Stock
        await increaseStock(item.id, returnQty);

        // 2. Update Sale Record
        item.qty -= returnQty;

        if (item.qty === 0) {
            sale.items.splice(itemIndex, 1);
        } else {
            sale.items[itemIndex] = item;
        }

        // Recalculate Sale Totals
        sale.totalAmount = sale.items.reduce((sum, i) => sum + (i.qty * i.price), 0);
        sale.totalProfit = sale.items.reduce((sum, i) => sum + ((i.price - (i.cost || 0)) * i.qty), 0);

        // Update payment info if exists
        if (sale.payment) {
            // We don't change cash received, but we update balance to reflect that we technically owe them the diff
            // New Balance = Cash - New Total
            // Note: If Cash < NewTotal (unlikely unless return makes total negative?), this would be weird, but for valid returns it simply increases balance (change due) or rather just corrects the record.
            // Actually, if I bought for 100, gave 100.
            // Return 50. New Total 50.
            // Cash still 100.
            // Balance logic: "How much I should have got back".
            // Original Balance: 0.
            // New Balance should be 100 - 50 = 50.
            // So this logic holds.
            sale.payment.balance = sale.payment.cash - sale.totalAmount;
        }

        await updateSale(saleId, sale);

        // 3. UI Feedback
        alert("Return processed successfully");
        closeSaleDetailModal();
        loadSalesHistory();
        loadProducts(); // Update inventory UI
        updateReports();

    } catch (e) {
        console.error("Return failed:", e);
        alert("Error processing return");
    }
}

async function returnFullBill(saleId) {
    if (!confirm("Are you sure you want to return the FULL bill? All items will be added back to stock and the sale will be zeroed out.")) return;

    try {
        const sale = await getSaleById(saleId);
        if (!sale) return;

        // 1. Update Stock for all items
        for (const item of sale.items) {
            await increaseStock(item.id, item.qty);
        }

        // 2. Clear items and totals
        sale.items = [];
        sale.subtotal = 0;
        sale.totalAmount = 0;
        sale.totalProfit = 0;
        if (sale.payment) {
            sale.payment.balance = sale.payment.cash; // Technically full refund due
        }

        await updateSale(saleId, sale);

        // 3. UI Feedback
        alert("Full bill returned successfully. Stock has been updated.");
        closeSaleDetailModal();
        loadSalesHistory();
        loadProducts(); // Update inventory UI
        updateReports();

    } catch (e) {
        console.error("Full bill return failed:", e);
        alert("Error processing full return");
    }
}

async function printSalesHistory() {
    try {
        if (typeof getAllSales !== 'function') {
            alert('Database not ready');
            return;
        }

        const sales = await getAllSales();
        const printContainer = document.getElementById('print-container');
        if (!printContainer) {
            alert('Print container not found');
            return;
        }

        const dateInput = document.getElementById('sales-filter-date');
        const dateFilter = dateInput ? dateInput.value : '';

        let filteredSales = sales;
        if (dateFilter) {
            const filterDateStr = new Date(dateFilter).toDateString();
            filteredSales = sales.filter(s => new Date(s.timestamp).toDateString() === filterDateStr);
        }

        let rowsHtml = '';
        let totalRevenue = 0;
        let totalProfit = 0;

        filteredSales.forEach(sale => {
            totalRevenue += sale.totalAmount;
            totalProfit += sale.totalProfit;
            rowsHtml += `
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px; text-align: left;">${new Date(sale.timestamp).toLocaleString()}</td>
                    <td style="padding: 8px; text-align: left;">${formatID(sale.id, 'INV')}</td>
                    <td style="padding: 8px; text-align: left;">${sale.customerName || 'Anonymous'}</td>
                    <td style="padding: 8px; text-align: left;">${sale.paymentStatus || 'Paid'}</td>
                    <td style="padding: 8px; text-align: right;">Rs. ${sale.totalAmount.toFixed(2)}</td>
                    <td style="padding: 8px; text-align: right;">Rs. ${sale.totalProfit.toFixed(2)}</td>
                    <td style="padding: 8px; text-align: right;">Rs. ${(sale.payment?.cash || 0).toFixed(2)}</td>
                    <td style="padding: 8px; text-align: right;">Rs. ${(sale.payment?.balance || 0).toFixed(2)}</td>
                </tr>
            `;
        });

        const reportHtml = `
            <div style="font-family: Arial, sans-serif; padding: 20px; width: 100%;">
                <h1 style="text-align: center; margin-bottom: 10px;">SK MART - Sales Report</h1>
                <p style="text-align: center; margin-bottom: 20px;">
                    ${dateFilter ? 'Date: ' + dateFilter : 'All History'}
                </p>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <thead>
                        <tr style="background-color: #f3f4f6; border-bottom: 2px solid #ddd;">
                            <th style="padding: 10px; text-align: left;">Time</th>
                            <th style="padding: 10px; text-align: left;">Receipt ID</th>
                            <th style="padding: 10px; text-align: left;">Customer</th>
                            <th style="padding: 10px; text-align: left;">Status</th>
                            <th style="padding: 10px; text-align: right;">Amount</th>
                            <th style="padding: 10px; text-align: right;">Profit</th>
                            <th style="padding: 10px; text-align: right;">Cash</th>
                            <th style="padding: 10px; text-align: right;">Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                    <tfoot>
                        <tr style="font-weight: bold; background-color: #f3f4f6;">
                            <td colspan="4" style="padding: 10px; text-align: right;">TOTALS:</td>
                            <td style="padding: 10px; text-align: right;">Rs. ${totalRevenue.toFixed(2)}</td>
                            <td style="padding: 10px; text-align: right;">Rs. ${totalProfit.toFixed(2)}</td>
                            <td colspan="2"></td>
                        </tr>
                    </tfoot>
                </table>
                <p style="text-align: center; font-size: 12px; color: #666;">Generated on ${new Date().toLocaleString()}</p>
            </div>
        `;

        // Reset styles for A4 printing
        const styleId = 'print-temp-history-style';
        let style = document.getElementById(styleId);
        if (!style) {
            style = document.createElement('style');
            style.id = styleId;
            document.head.appendChild(style);
        }
        style.innerHTML = `
            @media print {
                @page { size: A4 portrait; margin: 10mm; }
                body { overflow: visible !important; height: auto !important; width: 100% !important; background: white !important; }
                body > *:not(#print-container) { display: none !important; }
                #print-container { width: 100% !important; display: block !important; visibility: visible !important; }
            }
        `;

        printContainer.innerHTML = reportHtml;

        // Give browser a moment to render then print
        setTimeout(() => {
            window.print();
            // Cleanup
            if (style) style.remove();
            printContainer.innerHTML = '';
        }, 500);
    } catch (e) {
        console.error("Error printing sales:", e);
        alert("Could not print sales history. Check console.");
    }
}

async function exportInventoryToExcel() {
    try {
        const products = await getAllProducts();
        if (!products || products.length === 0) {
            alert("No inventory data to export");
            return;
        }

        // CSV Header
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Code,Name,Category,Cost Price,Retail Price,Stock,Low Stock Threshold\n";

        // Rows
        products.forEach(p => {
            const row = [
                `"${p.code || ''}"`,
                `"${p.name || ''}"`,
                `"${p.category || ''}"`,
                p.costPrice || 0,
                p.retailPrice || 0,
                p.stock || 0,
                p.lowStockThreshold || 3
            ].join(",");
            csvContent += row + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `sk_mart_inventory_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        console.error("Export Error:", e);
        alert("Failed to export inventory");
    }
}

async function backupFullDatabase() {
    try {
        const products = await getAllProducts();
        const sales = await getAllSales();

        const backupData = {
            version: 2,
            timestamp: new Date().toISOString(),
            data: { products, sales }
        };

        const json = JSON.stringify(backupData);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = `sk_mart_full_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Backup failed:", e);
        alert("Backup failed. See console for details.");
    }
}

async function restoreFullDatabase(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!confirm("WARNING: This will delete all current data on this device and replace it with the backup file. Are you sure?")) {
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const backup = JSON.parse(e.target.result);

            if (!backup.data || !backup.data.products || !backup.data.sales) {
                throw new Error("Invalid backup file format");
            }

            // Import data via new restore endpoint or bulk updates
            const response = await fetch('/api/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(backup.data)
            });

            if (!response.ok) throw new Error("Failed to restore data on server");

            alert("Data restored successfully! The page will now refresh.");
            window.location.reload();
        } catch (err) {
            console.error("Restore failed:", err);
            alert("Error: " + err.message);
        }
    };
    reader.readAsText(file);
}

// Ensure global access
window.backupFullDatabase = backupFullDatabase;
window.restoreFullDatabase = restoreFullDatabase;
window.exportInventoryToExcel = exportInventoryToExcel;
window.printSalesHistory = printSalesHistory;
window.updateCartItemQty = updateCartItemQty;
window.removeFromCart = removeFromCart;
window.editProduct = editProduct;
window.confirmDeleteProduct = confirmDeleteProduct;
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.closePaymentModal = closePaymentModal;
window.closeSuccessModal = closeSuccessModal;
window.viewSaleDetails = viewSaleDetails;
window.markSaleAsPaid = markSaleAsPaid;
window.closeSaleDetailModal = closeSaleDetailModal;
window.returnFullBill = returnFullBill;
window.initiateReturn = initiateReturn;
window.clearSalesHistory = clearSalesHistory;

// Connectivity detection removed as per user request

// --- Reports ---
async function updateReports() {
    try {
        if (typeof getAllSales !== 'function') return;
        const sales = await getAllSales();

        const now = new Date();
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));

        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const stats = {
            today: { rev: 0, prof: 0 },
            week: { rev: 0, prof: 0 },
            month: { rev: 0, prof: 0 }
        };

        const itemSales = {}; // productId -> { name, qty, rev }
        const categorySales = {}; // category -> { rev }

        sales.forEach(sale => {
            const saleDate = new Date(sale.timestamp);

            // Time periods
            if (saleDate >= startOfDay) {
                stats.today.rev += sale.totalAmount;
                stats.today.prof += sale.totalProfit;
            }
            if (saleDate >= startOfWeek) {
                stats.week.rev += sale.totalAmount;
                stats.week.prof += sale.totalProfit;
            }
            if (saleDate >= startOfMonth) {
                stats.month.rev += sale.totalAmount;
                stats.month.prof += sale.totalProfit;
            }

            // Item and Category stats
            sale.items.forEach(item => {
                // By Item
                if (!itemSales[item.id]) {
                    itemSales[item.id] = { name: item.name, qty: 0, rev: 0 };
                }
                itemSales[item.id].qty += item.qty;
                itemSales[item.id].rev += (item.price * item.qty);

                // By Category (We need to find category from currentProducts if not in item)
                // In this app, item in sale doesn't have category, let's fix that or lookup
                const prod = currentProducts.find(p => p.id === item.id);
                const cat = prod ? prod.category : 'General';
                if (!categorySales[cat]) categorySales[cat] = { rev: 0 };
                categorySales[cat].rev += (item.price * item.qty);
            });
        });

        // Update UI Summaries
        document.getElementById('today-revenue').textContent = `Rs. ${stats.today.rev.toFixed(2)}`;
        document.getElementById('today-profit').textContent = `Rs. ${stats.today.prof.toFixed(2)}`;
        document.getElementById('week-revenue').textContent = `Rs. ${stats.week.rev.toFixed(2)}`;
        document.getElementById('week-profit').textContent = `Rs. ${stats.week.prof.toFixed(2)}`;
        document.getElementById('month-revenue').textContent = `Rs. ${stats.month.rev.toFixed(2)}`;
        document.getElementById('month-profit').textContent = `Rs. ${stats.month.prof.toFixed(2)}`;

        // Update Top Products
        const topProductsList = document.getElementById('top-products-list');
        const sortedItems = Object.values(itemSales).sort((a, b) => b.qty - a.qty).slice(0, 5);

        if (sortedItems.length > 0) {
            topProductsList.innerHTML = sortedItems.map((item, idx) => `
                <div class="flex items-center justify-between p-3 ${idx < sortedItems.length - 1 ? 'border-b border-slate-50' : ''}">
                    <div class="flex items-center gap-3">
                        <span class="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">${idx + 1}</span>
                        <div>
                            <p class="text-sm font-medium text-slate-800">${item.name}</p>
                            <p class="text-[10px] text-slate-400">${item.qty} sold</p>
                        </div>
                    </div>
                    <p class="text-sm font-bold text-indigo-600">Rs. ${item.rev.toFixed(2)}</p>
                </div>
            `).join('');
        }

        // Update Top Categories
        const topCatsList = document.getElementById('top-categories-list');
        const sortedCats = Object.entries(categorySales).sort((a, b) => b[1].rev - a[1].rev).slice(0, 4);

        if (sortedCats.length > 0) {
            const totalCatRev = sortedCats.reduce((sum, c) => sum + c[1].rev, 0);
            topCatsList.innerHTML = sortedCats.map(([name, data]) => {
                const percent = (data.rev / totalCatRev) * 100;
                return `
                    <div class="space-y-1">
                        <div class="flex justify-between text-xs font-medium">
                            <span class="text-slate-600">${name}</span>
                            <span class="text-slate-400">${percent.toFixed(0)}%</span>
                        </div>
                        <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div class="h-full bg-indigo-500 rounded-full" style="width: ${percent}%"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }

    } catch (error) {
        console.error("Error updating reports:", error);
    }
}

// --- Security / Lock System ---
let lockTimer;
const IDLE_TIME_LIMIT = 10 * 60 * 1000; // 10 minutes

function setupLockTimer() {
    // Reset timer on any user activity
    window.onload = resetLockTimer;
    window.onmousemove = resetLockTimer;
    window.onmousedown = resetLockTimer; // catches touchscreen taps
    window.ontouchstart = resetLockTimer;
    window.onclick = resetLockTimer;     // catches touchpad clicks
    window.onkeydown = resetLockTimer;
    window.addEventListener('scroll', resetLockTimer, true); // improved scroll detection

    resetLockTimer();
}

function resetLockTimer() {
    clearTimeout(lockTimer);
    lockTimer = setTimeout(lockSystem, IDLE_TIME_LIMIT);
}

function lockSystem() {
    const lockScreen = document.getElementById('lock-screen');
    if (lockScreen) {
        lockScreen.classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
    }
}

function unlockSystem() {
    const lockScreen = document.getElementById('lock-screen');
    if (lockScreen) {
        lockScreen.classList.add('hidden');
    }
    resetLockTimer();
}

async function printSale(id) {
    try {
        const sale = await getSaleById(id);
        if (!sale) return;

        const formattedId = formatID(sale.id, 'INV');
        const receiptHtml = generateReceiptHTML(sale, formattedId);

        // We show the success-modal but customize it for a "Reprint" feel
        const successModal = document.getElementById('success-modal');
        if (successModal) {
            // Update modal text for reprint
            const titleEl = successModal.querySelector('h3');
            const descEl = successModal.querySelector('p');
            if (titleEl) titleEl.textContent = 'Receipt Preview';
            if (descEl) descEl.textContent = `Invoice: ${formattedId}`;

            successModal.classList.remove('hidden');
            if (window.lucide) lucide.createIcons();

            // Inject Receipt Preview
            const previewContainer = document.getElementById('receipt-preview-container');
            if (previewContainer) {
                previewContainer.innerHTML = receiptHtml;
            }

            // Setup Print Button for this specific sale
            const printBtn = document.getElementById('print-receipt-btn');
            if (printBtn) {
                printBtn.onclick = () => {
                    const printContainer = document.getElementById('print-container');
                    if (printContainer) {
                        printContainer.innerHTML = receiptHtml;

                        const styleId = 'print-temp-style';
                        let style = document.getElementById(styleId);
                        if (!style) {
                            style = document.createElement('style');
                            style.id = styleId;
                            document.head.appendChild(style);
                        }
                        style.innerHTML = `
                            @media print {
                                @page { size: 80mm auto; margin: 0; }
                                body { margin: 0 !important; padding: 0 !important; overflow: visible !important; height: auto !important; }
                                body > *:not(#print-container) { display: none !important; }
                                #print-container { display: block !important; visibility: visible !important; width: 80mm !important; margin: 0 !important; padding: 0 !important; }
                            }
                        `;

                        window.print();
                        if (style) style.remove();
                        printContainer.innerHTML = '';
                        closeSuccessModal();
                    }
                };
            }
        }
    } catch (e) {
        console.error("Error printing sale:", e);
    }
}

// Global Exports
window.lockSystem = lockSystem;
window.unlockSystem = unlockSystem;
window.printSale = printSale;
window.previousSalesPage = previousSalesPage;
window.nextSalesPage = nextSalesPage;
window.exportSalesToExcel = exportSalesToExcel;
window.loadSalesHistory = loadSalesHistory;
window.clearSalesHistory = clearSalesHistory;
