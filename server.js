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
const imagesDir = path.join(dataDir, 'images');
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir);

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
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname));

// Helper to read/write data
function readData() {
    const content = fs.readFileSync(dataFilePath, 'utf8');
    return JSON.parse(content);
}

function saveData(data) {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
}

// Helper to save base64 image to file
function saveBase64Image(base64Data, productCode) {
    try {
        if (!base64Data || !base64Data.startsWith('data:image')) return base64Data;

        const matches = base64Data.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) return base64Data;

        const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const fileName = `${productCode}.${extension}`;
        const filePath = path.join(imagesDir, fileName);

        fs.writeFileSync(filePath, buffer);
        console.log(`Saved image: ${fileName}`);
        return `data/images/${fileName}`; // Relative path
    } catch (e) {
        console.error("Error saving image:", e);
        return base64Data;
    }
}

// Migration Logic
function migrateImages() {
    console.log("Checking for image migration...");
    const data = readData();
    let migrated = false;

    data.products.forEach(p => {
        // Migration 1: Extraction from base64 (already done mostly)
        if (p.image && p.image.startsWith('data:image')) {
            console.log(`Migrating image for product: ${p.name}`);
            p.image = saveBase64Image(p.image, p.code);
            migrated = true;
        }

        // Migration 2: Renaming from ID-based to Code-based (Handle old patterns like PRD-177...)
        if (p.image && p.image.startsWith('data/images/')) {
            const currentFileName = path.basename(p.image);
            const extension = path.extname(currentFileName);
            const expectedFileName = `${p.code}${extension}`;

            if (currentFileName !== expectedFileName) {
                const currentPath = path.join(__dirname, p.image);
                const newRelativePath = `data/images/${expectedFileName}`;
                const newPath = path.join(__dirname, newRelativePath);

                if (fs.existsSync(currentPath)) {
                    try {
                        fs.renameSync(currentPath, newPath);
                        console.log(`Renamed: ${currentFileName} -> ${expectedFileName}`);
                        p.image = newRelativePath;
                        migrated = true;
                    } catch (e) {
                        console.error(`Error renaming ${currentFileName}:`, e);
                    }
                }
            }
        }
    });

    if (migrated) {
        saveData(data);
        console.log("Migration/Renaming complete. db.json updated.");
    } else {
        console.log("No migration/renaming needed.");
    }
}

migrateImages(); // Run migration on start

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

    // Determine ID first if new
    const id = p.id || Date.now();

    // Extract and save image if it's base64
    if (p.image && p.image.startsWith('data:image')) {
        p.image = saveBase64Image(p.image, p.code);
    }

    if (p.id) {
        const index = data.products.findIndex(item => item.id == p.id);
        if (index !== -1) {
            data.products[index] = { ...data.products[index], ...p };
        }
    } else {
        p.id = id;
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
    const product = data.products.find(p => p.id == req.params.id);

    if (product && product.image && product.image.startsWith('data/images/')) {
        const imagePath = path.join(__dirname, product.image);
        if (fs.existsSync(imagePath)) {
            try {
                fs.unlinkSync(imagePath);
                console.log(`Deleted image: ${product.image}`);
            } catch (e) {
                console.error("Error deleting image file:", e);
            }
        }
    }

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
    const { products, sales, categories } = req.body;
    const data = readData();

    // Overwrite all data with backup
    if (products) data.products = products;
    if (sales) data.sales = sales;
    if (categories) data.categories = categories;

    saveData(data);
    res.json({ success: true });
});

app.listen(port, () => {
    console.log(`AK Mart POS Server running at http://localhost:${port}`);
});
