# AK Mart POS System - Project Blueprint

This document outlines the business and technical requirements for building a lightweight, browser-based POS system for AK Mart using HTML, Tailwind CSS, and Dexie.js.

---

## 1. Business Requirements

### A. Product Categorization
The system must allow products to be sorted into the following categories:
* Women’s Wear
* Kids’ Wear
* Baby Diapers
* Adult Diapers
* Decoration Items
* Gift Items

### B. Inventory Management
* **Wholesale vs. Retail Tracking:** Each item must have a 'Cost Price' (Wholesale) and a 'Selling Price' (Retail).
* **Stock Levels:** Real-time tracking of item quantities.
* **Low Stock Alerts:** Visual indicators when stock falls below a certain threshold (e.g., 5 units).

### C. Sales & Checkout
* **Cart System:** Ability to search for items and add them to a virtual cart.
* **Pricing Logic:** Automatic calculation of the subtotal, tax (if applicable), and discounts.
* **Stock Deduction:** When a sale is finalized, the system must automatically subtract sold items from the inventory.

### D. Receipt Printing
* **Format:** Generate a clean, vertical receipt optimized for 80mm or 58mm thermal printers.
* **Details:** Must include Shop Name (AK Mart), Date, Item List, Total, and a "Thank You" message.

### E. Basic Reporting
* **Daily Sales:** Total revenue earned during the day.
* **Profit Analysis:** Calculate profit using the formula:
    $$\text{Profit} = \sum (\text{Retail Price} - \text{Wholesale Price})$$

---

## 2. Technical Requirements

### A. Frontend Stack
* **HTML5:** Structural backbone of the app.
* **Tailwind CSS:** For styling. Use the Play CDN for quick setup without complex installations.
* **Lucide-Icons:** For clean, professional-looking UI icons.

### B. Database (Dexie.js)
The system will use **Dexie.js** to manage the browser's IndexedDB. 
* **Table: `products`**
    * Fields: `++id, name, category, costPrice, retailPrice, stock`
* **Table: `sales`**
    * Fields: `++id, timestamp, items, totalAmount, totalProfit`

### C. UI Components Needed
1.  **Sidebar Navigation:** To switch between *Dashboard, POS, and Inventory*.
2.  **Inventory Form:** A modal or section to input new stock.
3.  **Search Bar:** A fast-filter search to find products by name or category.
4.  **Print Preview:** A hidden-from-screen HTML section that only appears when the print command is triggered.

---

## 3. Implementation Steps

### Step 1: Initialize the Project
Create a single `index.html` file and include the Tailwind and Dexie.js scripts in the `<head>`.

### Step 2: Database Setup
Write a script to initialize the database:
```javascript
const db = new Dexie("AKMart_DB");
db.version(1).stores({
  products: "++id, name, category",
  sales: "++id, timestamp"
})