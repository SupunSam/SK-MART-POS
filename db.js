/* db.js - API Wrapper for Node.js Backend */
const API_URL = '/api';

// Helper for fetch calls
async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    if (data) options.body = JSON.stringify(data);

    const response = await fetch(`${API_URL}${endpoint}`, options);
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'API call failed');
    }
    return await response.json();
}

// --- Category Operations ---

async function getAllCategories() {
    return await apiCall('/categories');
}

async function addCategory(category) {
    return await apiCall('/categories', 'POST', category);
}

async function deleteCategory(id) {
    return await apiCall(`/categories/${id}`, 'DELETE');
}

// --- Product Operations ---

async function addProduct(product) {
    return await apiCall('/products', 'POST', product);
}

async function updateProduct(id, updates) {
    return await apiCall('/products', 'POST', { id, ...updates });
}

async function deleteProduct(id) {
    return await apiCall(`/products/${id}`, 'DELETE');
}

async function getAllProducts() {
    return await apiCall('/products');
}

async function getProductById(id) {
    return await apiCall(`/products/${id}`);
}

async function decreaseStock(id, quantity) {
    return await apiCall(`/products/${id}/stock`, 'PATCH', { change: -quantity });
}

async function increaseStock(id, quantity) {
    return await apiCall(`/products/${id}/stock`, 'PATCH', { change: quantity });
}

// --- Sales Operations ---

async function recordSale(saleData) {
    const result = await apiCall('/sales', 'POST', saleData);
    return result.id;
}

async function getSaleById(id) {
    const sales = await apiCall('/sales');
    return sales.find(s => s.id == id);
}

async function getSalesByDateRange(startDate, endDate) {
    return await apiCall(`/sales/range?start=${startDate}&end=${endDate}`);
}

async function deleteAllSalesHistory() {
    return await apiCall('/sales', 'DELETE');
}

async function deleteSale(id) {
    return await apiCall(`/sales/${id}`, 'DELETE');
}

async function updateSale(id, updates) {
    return await apiCall('/sales', 'POST', { id, ...updates });
}

async function getAllSales() {
    return await apiCall('/sales');
}
