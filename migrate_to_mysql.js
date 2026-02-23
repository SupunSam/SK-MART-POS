const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const dbPath = path.join(__dirname, 'data', 'db.json');

async function main() {
    if (!fs.existsSync(dbPath)) {
        console.error("db.json not found!");
        return;
    }

    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

    console.log("Migrating Categories...");
    for (const cat of data.categories) {
        await prisma.category.upsert({
            where: { name: cat.name },
            update: {},
            create: {
                id: BigInt(cat.id),
                name: cat.name
            }
        });
    }
    console.log("Categories done.");

    console.log("Migrating Products...");
    for (const prod of data.products) {
        await prisma.product.upsert({
            where: { code: prod.code },
            update: {},
            create: {
                id: BigInt(prod.id),
                code: prod.code,
                name: prod.name,
                category: prod.category,
                costPrice: prod.costPrice,
                retailPrice: prod.retailPrice,
                discountRate: prod.discountRate || 0,
                discountType: prod.discountType || 'percent',
                stock: prod.stock || 0,
                lowStockThreshold: prod.lowStockThreshold || 3,
                image: prod.image
            }
        });
    }
    console.log("Products done.");

    console.log("Migrating Sales...");
    // Sales are empty in the provided db.json, but good to have the logic
    for (const sale of data.sales || []) {
        await prisma.sale.create({
            data: {
                id: BigInt(sale.id),
                timestamp: new Date(sale.timestamp),
                subtotal: sale.subtotal || 0,
                totalAmount: sale.totalAmount,
                totalProfit: sale.totalProfit,
                billDiscountRate: sale.billDiscountRate || 0,
                billDiscountValue: sale.billDiscountValue || 0,
                billDiscountType: sale.billDiscountType || 'percent',
                paymentCash: sale.payment?.cash || 0,
                paymentBalance: sale.payment?.balance || 0,
                paymentMethod: sale.paymentMethod || 'Cash',
                paymentStatus: sale.paymentStatus || 'Paid',
                customerName: sale.customerName,
                customerPhone: sale.customerPhone,
                items: {
                    create: sale.items.map(item => ({
                        productId: item.id ? BigInt(item.id) : null,
                        name: item.name,
                        code: item.code,
                        qty: item.qty,
                        price: item.price,
                        discountRate: item.discountRate,
                        discountValue: item.discountValue,
                        discountType: item.discountType
                    }))
                }
            }
        });
    }
    console.log("Sales done.");

    console.log("Full migration completed successfully!");
}

main()
    .catch(e => {
        console.error("Migration failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
