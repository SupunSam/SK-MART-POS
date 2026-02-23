const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const { PrismaClient } = require('./prisma/generated/client');
const prisma = new PrismaClient();

// Fix for BigInt serialization in JSON
BigInt.prototype.toJSON = function () {
    return this.toString();
};

const app = express();
const port = process.env.PORT || 3000;
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const imagesDir = path.join(dataDir, 'images');
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir);

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname));

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

// No migration needed here as data is now in MySQL

// --- API Endpoints ---

// Categories
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await prisma.category.findMany();
        res.json(categories);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/categories', async (req, res) => {
    try {
        const { name } = req.body;
        const newCategory = await prisma.category.create({
            data: { id: Date.now(), name }
        });
        res.json(newCategory);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/categories/:id', async (req, res) => {
    try {
        await prisma.category.delete({
            where: { id: BigInt(req.params.id) }
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Products
app.get('/api/products', async (req, res) => {
    try {
        const products = await prisma.product.findMany();
        res.json(products);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await prisma.product.findUnique({
            where: { id: BigInt(req.params.id) }
        });
        res.json(product);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/products', async (req, res) => {
    try {
        const p = req.body;
        const id = p.id ? BigInt(p.id) : BigInt(Date.now());

        // Handle image saving
        if (p.image && p.image.startsWith('data:image')) {
            p.image = saveBase64Image(p.image, p.code);
        }

        const productData = {
            code: p.code,
            name: p.name,
            category: p.category,
            costPrice: parseFloat(p.costPrice),
            retailPrice: parseFloat(p.retailPrice),
            discountRate: parseFloat(p.discountRate || 0),
            discountType: p.discountType || 'percent',
            stock: parseInt(p.stock || 0),
            lowStockThreshold: parseInt(p.lowStockThreshold || 3),
            image: p.image
        };

        const result = await prisma.product.upsert({
            where: { id: id },
            update: productData,
            create: { ...productData, id: id }
        });

        res.json({ id: result.id.toString() });
    } catch (e) {
        console.error("Error saving product:", e);
        res.status(500).json({ error: e.message });
    }
});

app.patch('/api/products/:id/stock', async (req, res) => {
    try {
        const { change } = req.body;
        await prisma.product.update({
            where: { id: BigInt(req.params.id) },
            data: { stock: { increment: change } }
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        const product = await prisma.product.findUnique({
            where: { id: BigInt(req.params.id) }
        });

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

        await prisma.product.delete({
            where: { id: BigInt(req.params.id) }
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Sales
app.get('/api/sales', async (req, res) => {
    try {
        const sales = await prisma.sale.findMany({
            include: { items: true },
            orderBy: { timestamp: 'desc' }
        });
        res.json(sales);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/sales', async (req, res) => {
    try {
        const s = req.body;

        if (s.id) {
            // Update existing sale
            const result = await prisma.sale.update({
                where: { id: BigInt(s.id) },
                data: {
                    paymentStatus: s.paymentStatus,
                    customerName: s.customerName,
                    customerPhone: s.customerPhone
                    // Add other fields as needed for updates
                },
                include: { items: true }
            });
            return res.json({ id: result.id.toString(), updated: true });
        }

        // Create new sale
        // Generate a 12-digit incremental ID or use timestamp
        // The user suggested using incremental IDs for sales
        const lastSale = await prisma.sale.findFirst({
            orderBy: { id: 'desc' }
        });

        // Fix: If lastSale ID is very large (timestamp), fallback to 0 for incremental start
        let nextId = BigInt(Date.now()); // Default to timestamp as before
        if (lastSale && lastSale.id < BigInt(1000000000000)) {
            nextId = lastSale.id + BigInt(1);
        } else if (!lastSale) {
            nextId = BigInt(1);
        }

        const newSale = await prisma.sale.create({
            data: {
                id: nextId,
                timestamp: s.timestamp ? new Date(s.timestamp) : new Date(),
                subtotal: parseFloat(s.subtotal || 0),
                totalAmount: parseFloat(s.totalAmount),
                totalProfit: parseFloat(s.totalProfit),
                billDiscountRate: parseFloat(s.billDiscountRate || 0),
                billDiscountValue: parseFloat(s.billDiscountValue || 0),
                billDiscountType: s.billDiscountType || 'percent',
                paymentCash: parseFloat(s.payment?.cash || 0),
                paymentBalance: parseFloat(s.payment?.balance || 0),
                paymentMethod: s.paymentMethod,
                paymentStatus: s.paymentStatus,
                customerName: s.customerName,
                customerPhone: s.customerPhone,
                items: {
                    create: s.items.map(item => ({
                        productId: item.id ? BigInt(item.id) : null,
                        name: item.name,
                        code: item.code,
                        qty: parseInt(item.qty),
                        price: parseFloat(item.price),
                        discountRate: parseFloat(item.discountRate || 0),
                        discountValue: parseFloat(item.discountValue || 0),
                        discountType: item.discountType
                    }))
                }
            },
            include: { items: true }
        });

        res.json({ id: newSale.id.toString() });
    } catch (e) {
        console.error("Error saving sale:", e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/sales', async (req, res) => {
    try {
        await prisma.saleItem.deleteMany({});
        await prisma.sale.deleteMany({});
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Backup/Restore
app.post('/api/restore', async (req, res) => {
    try {
        const { products, sales, categories } = req.body;

        // Clear existing data (Be careful here)
        if (categories) {
            await prisma.product.deleteMany({}); // Delete products first due to potential dependency (though currently it's just a string)
            await prisma.category.deleteMany({});
            for (const cat of categories) {
                await prisma.category.create({
                    data: { id: BigInt(cat.id), name: cat.name }
                });
            }
        }

        if (products) {
            await prisma.product.deleteMany({});
            for (const p of products) {
                await prisma.product.create({
                    data: {
                        id: BigInt(p.id),
                        code: p.code,
                        name: p.name,
                        category: p.category,
                        costPrice: parseFloat(p.costPrice),
                        retailPrice: parseFloat(p.retailPrice),
                        discountRate: parseFloat(p.discountRate || 0),
                        discountType: p.discountType || 'percent',
                        stock: parseInt(p.stock || 0),
                        lowStockThreshold: parseInt(p.lowStockThreshold || 3),
                        image: p.image
                    }
                });
            }
        }

        if (sales) {
            await prisma.saleItem.deleteMany({});
            await prisma.sale.deleteMany({});
            for (const s of sales) {
                await prisma.sale.create({
                    data: {
                        id: BigInt(s.id),
                        timestamp: new Date(s.timestamp),
                        subtotal: parseFloat(s.subtotal || 0),
                        totalAmount: parseFloat(s.totalAmount),
                        totalProfit: parseFloat(s.totalProfit),
                        billDiscountRate: parseFloat(s.billDiscountRate || 0),
                        billDiscountValue: parseFloat(s.billDiscountValue || 0),
                        billDiscountType: s.billDiscountType || 'percent',
                        paymentCash: parseFloat(s.payment?.cash || 0),
                        paymentBalance: parseFloat(s.payment?.balance || 0),
                        paymentMethod: s.paymentMethod,
                        paymentStatus: s.paymentStatus,
                        customerName: s.customerName,
                        customerPhone: s.customerPhone,
                        items: {
                            create: s.items.map(item => ({
                                productId: item.id ? BigInt(item.id) : null,
                                name: item.name,
                                code: item.code,
                                qty: parseInt(item.qty),
                                price: parseFloat(item.price),
                                discountRate: parseFloat(item.discountRate || 0),
                                discountValue: parseFloat(item.discountValue || 0),
                                discountType: item.discountType
                            }))
                        }
                    }
                });
            }
        }

        res.json({ success: true });
    } catch (e) {
        console.error("Restore failed:", e);
        res.status(500).json({ error: e.message });
    }
});

app.listen(port, () => {
    console.log(`AK Mart POS Server running at http://localhost:${port}`);
});
