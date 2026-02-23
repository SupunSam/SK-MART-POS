const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const dataFilePath = path.join(dataDir, 'db.json');

// Initialize Data if not exists
if (!fs.existsSync(dataFilePath)) {
    const initialData = {
        categories: [],
        products: [],
        sales: []
    };
    fs.writeFileSync(dataFilePath, JSON.stringify(initialData, null, 2));
}

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Helper to read/write data
function readData() {
    const content = fs.readFileSync(dataFilePath, 'utf8');
    return JSON.parse(content);
}

function saveData(data) {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
}

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// --- API Endpoints ---

// Categories
app.get('/api/categories', (req, res) => {
    const data = readData();
    res.json(data.categories);
});

app.post('/api/categories', (req, res) => {
    const { name } = req.body;
    const data = readData();
    const newCategory = { id: Date.now(), name };
    data.categories.push(newCategory);
    saveData(data);
    res.json(newCategory);
});

app.delete('/api/categories/:id', (req, res) => {
    const data = readData();
    data.categories = data.categories.filter(c => c.id != req.params.id);
    saveData(data);
    res.json({ success: true });
});

// Products
app.get('/api/products', (req, res) => {
    const data = readData();
    res.json(data.products);
});

app.get('/api/products/:id', (req, res) => {
    const data = readData();
    const product = data.products.find(p => p.id == req.params.id);
    res.json(product);
});

app.post('/api/products', (req, res) => {
    const p = req.body;
    const data = readData();
    if (p.id) {
        const index = data.products.findIndex(item => item.id == p.id);
        if (index !== -1) {
            data.products[index] = { ...data.products[index], ...p };
        }
    } else {
        p.id = Date.now();
        data.products.push(p);
    }
    saveData(data);
    res.json({ id: p.id });
});

app.patch('/api/products/:id/stock', (req, res) => {
    const { change } = req.body;
    const data = readData();
    const index = data.products.findIndex(p => p.id == req.params.id);
    if (index !== -1) {
        data.products[index].stock += change;
        saveData(data);
    }
    res.json({ success: true });
});

app.delete('/api/products/:id', (req, res) => {
    const data = readData();
    data.products = data.products.filter(p => p.id != req.params.id);
    saveData(data);
    res.json({ success: true });
});

// Sales
app.get('/api/sales', (req, res) => {
    const data = readData();
    res.json(data.sales.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
});

app.post('/api/sales', (req, res) => {
    const s = req.body;
    const data = readData();

    if (s.id) {
        // Update existing sale
        const index = data.sales.findIndex(sale => sale.id == s.id);
        if (index !== -1) {
            data.sales[index] = { ...data.sales[index], ...s };
            saveData(data);
            return res.json({ id: s.id, updated: true });
        }
    }

    // Create new sale
    // Find max numeric ID (excluding timestamp-based ones)
    let maxId = 0;
    data.sales.forEach(sale => {
        const id = Number(sale.id);
        if (!isNaN(id) && id < 1000000000000) { // IDs < 10^12 are likely incremental
            if (id > maxId) maxId = id;
        }
    });

    s.id = maxId + 1;
    data.sales.push(s);
    saveData(data);
    res.json({ id: s.id });
});

app.delete('/api/sales', (req, res) => {
    const data = readData();
    data.sales = [];
    saveData(data);
    res.json({ success: true });
});

// Backup/Restore
app.post('/api/restore', (req, res) => {
    const { products, sales } = req.body;
    const data = readData();

    // We overwrite products and sales but keep categories (or we could overwrite everything)
    // For a "Full Restore", let's overwrite everything that comes in.
    if (products) data.products = products;
    if (sales) data.sales = sales;

    saveData(data);
    res.json({ success: true });
});

app.listen(port, () => {
    console.log(`AK Mart POS Server running at http://localhost:${port}`);
});
