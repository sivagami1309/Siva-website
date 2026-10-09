require('dotenv').config();


const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 8080;
const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "siva_mart",
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD
});

async function ensureDatabaseSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS buyers (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      full_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT buyers_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sellers (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      full_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL,
      store_name VARCHAR(150),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT sellers_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(80) NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      seller_id INTEGER NOT NULL,
      category_id INTEGER,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      price NUMERIC(10,2) NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      image_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      brand VARCHAR(150),
      CONSTRAINT products_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS carts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id SERIAL PRIMARY KEY,
      cart_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      price NUMERIC(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT cart_items_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
      CONSTRAINT cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS wishlist_items (
      id SERIAL PRIMARY KEY,
      buyer_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT wishlist_items_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT wishlist_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      CONSTRAINT wishlist_unique UNIQUE (buyer_id, product_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      total_amount NUMERIC(10,2) NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'confirmed',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      seller_id INTEGER,
      quantity INTEGER NOT NULL,
      price NUMERIC(10,2) NOT NULL,
      subtotal NUMERIC(10,2),
      CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL,
      payment_method VARCHAR(80) NOT NULL,
      payment_status VARCHAR(40) NOT NULL DEFAULT 'paid',
      amount NUMERIC(10,2) NOT NULL,
      transaction_reference VARCHAR(150),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
  `);
  // ============================================================
  // FIX PRODUCTS -> SELLERS FOREIGN KEY
  // products.seller_id must refer to sellers.id
  // ============================================================
  try {
    await pool.query(`
      ALTER TABLE products
      DROP CONSTRAINT IF EXISTS products_seller_id_fkey;

      ALTER TABLE products
      ADD CONSTRAINT products_seller_id_fkey
      FOREIGN KEY (seller_id)
      REFERENCES sellers(id)
      ON DELETE CASCADE;
    `);

    console.log("Products seller foreign key is correct.");
  } catch (error) {
    console.error(
      "Products seller FK migration warning:",
      error.message
    );
  }
  const addColumns = [
    "ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
    "ALTER TABLE IF EXISTS order_items ADD COLUMN IF NOT EXISTS seller_id INTEGER;",
    "ALTER TABLE IF EXISTS order_items ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2);",
    "ALTER TABLE IF EXISTS carts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
    "ALTER TABLE IF EXISTS cart_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
    "ALTER TABLE IF EXISTS cart_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
    "ALTER TABLE IF EXISTS wishlist_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
    "ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS transaction_reference VARCHAR(150);",
    "ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"
  ];

  for (const sql of addColumns) {
    try {
      await pool.query(sql);
    } catch (error) {
      console.error("Schema migration warning:", error.message);
    }
  }

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
    CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
    CREATE INDEX IF NOT EXISTS idx_wishlist_buyer ON wishlist_items(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
  `);
}

async function getUserProfile(userId) {
  const result = await pool.query(
    "SELECT id, full_name, email, role FROM users WHERE id = $1 LIMIT 1",
    [userId]
  );
  return result.rows[0] || null;
}

async function ensureRoleProfile(userId, fullName, email, role, storeName = "") {
  if (role === "buyer") {
    await pool.query(
      `INSERT INTO buyers (user_id, full_name, email)
       SELECT $1, $2, $3
       WHERE NOT EXISTS (SELECT 1 FROM buyers WHERE user_id = $1)`,
      [userId, fullName, email]
    );
  }

  if (role === "seller") {
    await pool.query(
      `INSERT INTO sellers (user_id, full_name, email, store_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         email = EXCLUDED.email,
         store_name = EXCLUDED.store_name`,
      [userId, fullName, email, storeName]
    );
  }
}

function readUserContext(request) {
  const userId = Number(request.headers["x-user-id"] || request.query.userId || request.body?.userId);
  const role = String(request.headers["x-user-role"] || request.body?.role || "").trim().toLowerCase();

  return {
    userId: Number.isFinite(userId) && userId > 0 ? userId : null,
    role
  };
}

async function requireUser(request, response, requiredRole) {
  const { userId, role } = readUserContext(request);

  if (!userId) {
    response.status(401).json({ message: "Authentication required." });
    return null;
  }

  const user = await getUserProfile(userId);
  if (!user) {
    response.status(401).json({ message: "User not found." });
    return null;
  }

  if (requiredRole && user.role !== requiredRole) {
    response.status(403).json({ message: "Unauthorized." });
    return null;
  }

  const finalRole = requiredRole || role || user.role;
  if (finalRole && user.role !== finalRole) {
    response.status(403).json({ message: "Role mismatch." });
    return null;
  }

  return { user };
}

async function requireAdmin(request, response) {
  const auth = await requireUser(request, response, "admin");
  if (!auth) return null;
  return auth.user;
}

async function ensureBuyerCart(userId) {
  const cartResult = await pool.query(
    "SELECT id FROM carts WHERE user_id = $1 LIMIT 1",
    [userId]
  );

  if (cartResult.rows[0]) {
    return cartResult.rows[0].id;
  }

  const newCart = await pool.query(
    "INSERT INTO carts (user_id) VALUES ($1) RETURNING id",
    [userId]
  );

  return newCart.rows[0].id;
}

async function getCartSummary(userId) {
  const cartId = await ensureBuyerCart(userId);

  const items = await pool.query(`
    SELECT ci.id, ci.product_id, ci.quantity, ci.price,
           p.name AS product_name, p.image_url, p.stock,
           c.name AS category_name,
           p.seller_id
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE ci.cart_id = $1
    ORDER BY ci.created_at DESC
  `, [cartId]);

  const subtotal = items.rows.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);

  return {
    cart_id: cartId,
    items: items.rows,
    item_count: items.rows.reduce((sum, item) => sum + Number(item.quantity), 0),
    subtotal: Number(subtotal.toFixed(2))
  };
}

async function getCategoryId(name) {
  if (!name) return null;
  const cleaned = String(name).trim();
  if (!cleaned) return null;

  const existing = await pool.query(
    "SELECT id FROM categories WHERE LOWER(name) = LOWER($1) LIMIT 1",
    [cleaned]
  );

  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const created = await pool.query(
    "INSERT INTO categories (name) VALUES ($1) RETURNING id",
    [cleaned]
  );

  return created.rows[0].id;
}

app.use(cors());
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "..", "frontend")));

app.post("/api/register", async (request, response) => {
  try {
    const { email, password, role } = request.body;
    const fullName = request.body.full_name ?? request.body.fullName;
    const storeName = String(request.body.store_name ?? request.body.storeName ?? "").trim();

    const cleanedName = String(fullName || "").trim();
    const cleanedEmail = String(email || "").trim().toLowerCase();
    const cleanedPassword = String(password || "");
    const cleanedRole = String(role || "buyer").trim().toLowerCase();

    if (!cleanedName || !cleanedEmail || !cleanedPassword) {
      return response.status(400).json({
        message: "Full name, email and password are required."
      });
    }

    if (!["buyer", "seller"].includes(cleanedRole)) {
      return response.status(400).json({
        message: "Invalid account type."
      });
    }

    if (cleanedRole === "seller" && !storeName) {
      return response.status(400).json({
        message: "Store name is required for seller accounts."
      });
    }

    if (cleanedPassword.length < 6) {
      return response.status(400).json({
        message: "Password must contain at least 6 characters."
      });
    }

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [cleanedEmail]
    );

    if (existingUser.rows.length > 0) {
      return response.status(409).json({
        message: "An account with this email already exists."
      });
    }

    const passwordHash = await bcrypt.hash(cleanedPassword, 10);

    const userResult = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, role`,
      [cleanedName, cleanedEmail, passwordHash, cleanedRole]
    );

    const user = userResult.rows[0];

    await ensureRoleProfile(
      user.id,
      user.full_name,
      user.email,
      user.role,
      storeName
    );

    if (user.role === "buyer") {
      await ensureBuyerCart(user.id);
    }

    return response.status(201).json({
      message: "Account created successfully.",
      user
    });
  } catch (error) {
    console.error("Registration error:", error);

    return response.status(500).json({
      message: "Unable to create account right now."
    });
  }
});
app.post("/api/login", async (request, response) => {
  try {
    const { email, password, role } = request.body || {};
    const cleanedEmail = String(email || "").trim().toLowerCase();
    const cleanedPassword = String(password || "");
    const cleanedRole = String(role || "").trim().toLowerCase();

    if (!cleanedEmail || !cleanedPassword || !["buyer", "seller", "admin"].includes(cleanedRole)) {
      return response.status(400).json({ message: "Enter a valid email, password, and account type." });
    }

    const result = await pool.query(
      `SELECT users.id, users.full_name, users.email, users.role,
              sellers.store_name,
              COALESCE(to_jsonb(users)->>'password_hash', to_jsonb(users)->>'password') AS password_hash
       FROM users
       LEFT JOIN sellers ON sellers.user_id = users.id
       WHERE LOWER(users.email) = $1
       LIMIT 1`,
      [cleanedEmail]
    );
    const user = result.rows[0];

    if (
      !user ||
      user.role !== cleanedRole ||
      !user.password_hash ||
      !(await bcrypt.compare(cleanedPassword, user.password_hash))
    ) {
      return response.status(401).json({ message: "Incorrect email, password, or account type." });
    }

    const safeUser = {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      store_name: user.store_name || ""
    };
    return response.json({ message: "Login successful.", user: safeUser });
  } catch (error) {
    console.error("Login error:", error);
    return response.status(500).json({ message: "Unable to sign in right now." });
  }
});
app.get("/api/health", async (_request, response) => {
  try {
    await pool.query("SELECT 1");
    response.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("Database health check failed:", error.message);
    response.status(503).json({ status: "error", database: "disconnected" });
  }
});
app.get("/api/categories", async (_request, response) => {
  try {
    const result = await pool.query(
      "SELECT id, name FROM categories ORDER BY name"
    );
    return response.json(result.rows);
  } catch (error) {
    console.error("Category fetch failed:", error.message);
    return response.status(500).json({ message: "Unable to load categories." });
  }
});

app.get("/api/admin/stats", async (request, response) => {
  const adminUser = await requireAdmin(request, response);
  if (!adminUser) return;

  try {
    const [totalUsers, buyers, sellers, products, orders, value] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS total FROM users"),
      pool.query("SELECT COUNT(*)::int AS total FROM users WHERE role = 'buyer'"),
      pool.query("SELECT COUNT(*)::int AS total FROM users WHERE role = 'seller'"),
      pool.query("SELECT COUNT(*)::int AS total FROM products"),
      pool.query("SELECT COUNT(*)::int AS total FROM orders"),
      pool.query("SELECT COALESCE(SUM(total_amount), 0)::numeric AS total FROM orders WHERE total_amount IS NOT NULL")
    ]);

    return response.json({
      totals: {
        users: Number(totalUsers.rows[0]?.total || 0),
        buyers: Number(buyers.rows[0]?.total || 0),
        sellers: Number(sellers.rows[0]?.total || 0),
        products: Number(products.rows[0]?.total || 0),
        orders: Number(orders.rows[0]?.total || 0),
        orderValue: Number(value.rows[0]?.total || 0)
      }
    });
  } catch (error) {
    console.error("Admin stats failed:", error.message);
    return response.status(500).json({ message: "Unable to load dashboard statistics." });
  }
});

app.get("/api/admin/users", async (request, response) => {
  const adminUser = await requireAdmin(request, response);
  if (!adminUser) return;

  try {
    const search = String(request.query.search || "").trim();
    const role = String(request.query.role || "all").trim().toLowerCase();
    const values = [];
    const conditions = [];

    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(
        LOWER(full_name) LIKE LOWER($${values.length})
        OR LOWER(email) LIKE LOWER($${values.length})
      )`);
    }

    if (role && role !== "all") {
      values.push(role);
      conditions.push(`LOWER(role) = LOWER($${values.length})`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query(
      `
      SELECT id, full_name, email, role, created_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC NULLS LAST, id ASC
      `,
      values
    );

    return response.json(result.rows);
  } catch (error) {
    console.error("Admin user fetch failed:", error.message);
    return response.status(500).json({ message: "Unable to load users." });
  }
});

app.get("/api/admin/products", async (request, response) => {
  const adminUser = await requireAdmin(request, response);
  if (!adminUser) return;

  try {
    const search = String(request.query.search || "").trim();
    const category = String(request.query.category || "").trim();
    const values = [];
    const conditions = [];

    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(
        LOWER(p.name) LIKE LOWER($${values.length})
        OR LOWER(COALESCE(p.description, '')) LIKE LOWER($${values.length})
      )`);
    }

    if (category && category.toLowerCase() !== "all") {
      values.push(category);
      conditions.push(`(
        c.id::text = $${values.length}
        OR LOWER(COALESCE(c.name, '')) = LOWER($${values.length})
      )`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query(
      `
      SELECT p.id, p.name, p.price, p.stock, p.category_id, c.name AS category_name,
             s.id AS seller_id, s.store_name, s.full_name AS seller_name,
             u.email AS seller_email, p.created_at
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN sellers s ON s.id = p.seller_id
      LEFT JOIN users u ON u.id = s.user_id
      ${whereClause}
      ORDER BY p.created_at DESC, p.id ASC
      `,
      values
    );

    return response.json(result.rows);
  } catch (error) {
    console.error("Admin product fetch failed:", error.message);
    return response.status(500).json({ message: "Unable to load products." });
  }
});

app.get("/api/admin/orders", async (request, response) => {
  const adminUser = await requireAdmin(request, response);
  if (!adminUser) return;

  try {
    const search = String(request.query.search || "").trim();
    const status = String(request.query.status || "all").trim().toLowerCase();
    const values = [];
    const conditions = [];

    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(
        o.id::text LIKE $${values.length}
        OR LOWER(COALESCE(u.full_name, '')) LIKE LOWER($${values.length})
        OR LOWER(COALESCE(u.email, '')) LIKE LOWER($${values.length})
      )`);
    }

    if (status && status !== "all") {
      values.push(status);
      conditions.push(`LOWER(COALESCE(o.status, '')) = LOWER($${values.length})`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query(
      `
      SELECT o.id, o.user_id, u.full_name AS buyer_name, u.email AS buyer_email,
             o.status, o.total_amount, o.created_at,
             COUNT(oi.id) AS item_count
      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      ${whereClause}
      GROUP BY o.id, u.full_name, u.email
      ORDER BY o.created_at DESC, o.id ASC
      `,
      values
    );

    return response.json(result.rows);
  } catch (error) {
    console.error("Admin order fetch failed:", error.message);
    return response.status(500).json({ message: "Unable to load orders." });
  }
});

app.delete("/api/admin/products/:id", async (request, response) => {
  const adminUser = await requireAdmin(request, response);
  if (!adminUser) return;

  const productId = Number(request.params.id);
  if (!Number.isSafeInteger(productId) || productId <= 0) {
    return response.status(400).json({ message: "Invalid product id." });
  }

  try {
    const productCheck = await pool.query(
      "SELECT id, name FROM products WHERE id = $1 LIMIT 1",
      [productId]
    );

    if (!productCheck.rows[0]) {
      return response.status(404).json({ message: "Product not found." });
    }

    const ordered = await pool.query(
      "SELECT 1 FROM order_items WHERE product_id = $1 LIMIT 1",
      [productId]
    );

    if (ordered.rows.length > 0) {
      return response.status(409).json({
        message: "This product has existing order history and cannot be deleted safely. Please archive or hide it instead."
      });
    }

    await pool.query("DELETE FROM products WHERE id = $1", [productId]);
    return response.json({ message: "Product deleted successfully." });
  } catch (error) {
    console.error("Admin product delete failed:", error.message);
    return response.status(500).json({ message: "Unable to delete product." });
  }
});

// ============================================================
// BUYER - GET ALL PRODUCTS
// Seller-added products will appear here for Buyers
// ============================================================
app.get("/api/products", async (request, response) => {
  try {
    const search = String(request.query.search || "").trim();
    const category = String(request.query.category || "").trim();

    const values = [];
    const conditions = [];

    if (search) {
      values.push(`%${search}%`);
      conditions.push(`
        (
          LOWER(p.name) LIKE LOWER($${values.length})
          OR LOWER(COALESCE(p.description, '')) LIKE LOWER($${values.length})
          OR LOWER(COALESCE(p.brand, '')) LIKE LOWER($${values.length})
        )
      `);
    }

    if (category && category.toLowerCase() !== "all") {
      values.push(category);
      conditions.push(`
        (
          c.id::text = $${values.length}
          OR LOWER(COALESCE(c.name, '')) = LOWER($${values.length})
        )
      `);
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const result = await pool.query(
      `
      SELECT
        p.id,
        p.name,
        p.description,
        p.price,
        p.stock,
        p.image_url,
        p.brand,
        p.created_at,
        p.updated_at,

        c.id AS category_id,
        c.name AS category_name,

        s.id AS seller_id,
        s.store_name,
        s.full_name AS seller_name

      FROM products p

      LEFT JOIN categories c
        ON c.id = p.category_id

      LEFT JOIN sellers s
        ON s.id = p.seller_id

      ${whereClause}

      ORDER BY p.created_at DESC
      `,
      values
    );

    return response.json(result.rows);

  } catch (error) {
    console.error("Buyer product fetch failed:", error.message);

    return response.status(500).json({
      message: "Unable to load products.",
      error: error.message
    });
  }
});
app.get("/api/products/:id", async (request, response) => {
  const productId = Number(request.params.id);
  if (!Number.isSafeInteger(productId) || productId <= 0) {
    return response.status(400).json({ message: "Invalid product id." });
  }

  try {
    const result = await pool.query(`
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = $1
      LIMIT 1
    `, [productId]);

    if (!result.rows[0]) {
      return response.status(404).json({ message: "Product not found." });
    }

    return response.json(result.rows[0]);
  } catch (error) {
    console.error("Product fetch failed:", error.message);
    return response.status(500).json({ message: "Unable to load product." });
  }
});
app.post("/api/products", async (request, response) => {
  const auth = await requireUser(request, response, "seller");
  if (!auth) return;

  const {
    name,
    description,
    category,
    category_id,
    price,
    stock,
    image_url,
    brand
  } = request.body || {};

  const productName = String(name || "").trim();
  const parsedPrice = Number(price);
  const parsedStock = Number(stock || 0);

  // Validate product data
  if (
    !productName ||
    !Number.isFinite(parsedPrice) ||
    parsedPrice <= 0 ||
    !Number.isFinite(parsedStock) ||
    parsedStock < 0
  ) {
    return response.status(400).json({
      message: "Please provide a valid product name, price, and stock."
    });
  }

  try {
    // =========================================================
    // IMPORTANT:
    // auth.user.id = users.id
    // products.seller_id = sellers.id
    //
    // So first find sellers.id using users.id
    // =========================================================

    const sellerResult = await pool.query(
      `
      SELECT id
      FROM sellers
      WHERE user_id = $1
      LIMIT 1
      `,
      [auth.user.id]
    );

    if (sellerResult.rows.length === 0) {
      return response.status(403).json({
        message: "Seller profile not found for this user."
      });
    }

    const sellerId = sellerResult.rows[0].id;


    // =========================================================
    // CATEGORY
    // =========================================================

    const resolvedCategoryId =
      category_id
        ? Number(category_id)
        : await getCategoryId(category);


    // =========================================================
    // INSERT PRODUCT
    // =========================================================

    const result = await pool.query(
      `
      INSERT INTO products
      (
        seller_id,
        category_id,
        name,
        description,
        price,
        stock,
        image_url,
        brand
      )
      VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [
        sellerId,
        resolvedCategoryId || null,
        productName,
        description || "",
        parsedPrice,
        parsedStock,
        image_url || "",
        brand || ""
      ]
    );


    // =========================================================
    // SUCCESS
    // =========================================================

    return response.status(201).json({
      message: "Product added successfully.",
      product: result.rows[0]
    });

  } catch (error) {

    console.error(
      "Product creation failed:",
      error.message
    );

    return response.status(500).json({
      message: "Unable to add product.",
      error: error.message
    });
  }
});

// ============================================================
// SELLER - UPDATE PRODUCT
// ============================================================
app.put("/api/products/:id", async (request, response) => {
  const auth = await requireUser(request, response, "seller");
  if (!auth) return;

  const productId = Number(request.params.id);

  if (!Number.isFinite(productId) || productId <= 0) {
    return response.status(400).json({
      message: "Invalid product id."
    });
  }

  try {
    // ----------------------------------------------------------
    // Check that this product belongs to the logged-in seller
    // users.id -> sellers.user_id -> sellers.id -> products.seller_id
    // ----------------------------------------------------------
    const productCheck = await pool.query(
      `
      SELECT
        p.id,
        p.seller_id
      FROM products p
      JOIN sellers s
        ON s.id = p.seller_id
      WHERE p.id = $1
        AND s.user_id = $2
      LIMIT 1
      `,
      [productId, auth.user.id]
    );

    const product = productCheck.rows[0];

    if (!product) {
      return response.status(404).json({
        message: "Product not found or you are not allowed to edit it."
      });
    }

    const {
      name,
      description,
      category,
      category_id,
      price,
      stock,
      image_url,
      brand
    } = request.body || {};

    const productName = String(name || "").trim();

    const parsedPrice = Number(price);
    const parsedStock = Number(stock);

    if (
      !productName ||
      !Number.isFinite(parsedPrice) ||
      parsedPrice <= 0 ||
      !Number.isFinite(parsedStock) ||
      parsedStock < 0
    ) {
      return response.status(400).json({
        message: "Product details are incomplete or invalid."
      });
    }

    const resolvedCategoryId =
      category_id
        ? Number(category_id)
        : await getCategoryId(category);

    const result = await pool.query(
      `
      UPDATE products
      SET
        name = $1,
        description = $2,
        category_id = $3,
        price = $4,
        stock = $5,
        image_url = $6,
        brand = $7,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
      `,
      [
        productName,
        description || "",
        resolvedCategoryId || null,
        parsedPrice,
        parsedStock,
        image_url || "",
        brand || "",
        productId
      ]
    );

    return response.json({
      message: "Product updated successfully.",
      product: result.rows[0]
    });

  } catch (error) {
    console.error(
      "Product update failed:",
      error.message
    );

    return response.status(500).json({
      message: "Unable to update product.",
      error: error.message
    });
  }
});

// ============================================================
// SELLER - DELETE PRODUCT
// ============================================================
app.delete("/api/products/:id", async (request, response) => {
  const auth = await requireUser(request, response, "seller");
  if (!auth) return;

  const productId = Number(request.params.id);

  if (!Number.isFinite(productId) || productId <= 0) {
    return response.status(400).json({
      message: "Invalid product id."
    });
  }

  try {
    // ----------------------------------------------------------
    // Check ownership
    // users.id -> sellers.user_id -> sellers.id -> products.seller_id
    // ----------------------------------------------------------
    const productCheck = await pool.query(
      `
      SELECT
        p.id,
        p.seller_id
      FROM products p
      JOIN sellers s
        ON s.id = p.seller_id
      WHERE p.id = $1
        AND s.user_id = $2
      LIMIT 1
      `,
      [productId, auth.user.id]
    );

    const product = productCheck.rows[0];

    if (!product) {
      return response.status(404).json({
        message: "Product not found or you are not allowed to delete it."
      });
    }

    await pool.query(
      "DELETE FROM products WHERE id = $1",
      [productId]
    );

    return response.json({
      message: "Product deleted successfully."
    });

  } catch (error) {
    console.error(
      "Product delete failed:",
      error.message
    );

    return response.status(500).json({
      message: "Unable to delete product.",
      error: error.message
    });
  }
});

app.get("/api/seller/products", async (request, response) => {
  const auth = await requireUser(request, response, "seller");
  if (!auth) return;

  try {
    const result = await pool.query(`
      SELECT p.id, p.name, p.description, p.price, p.stock, p.image_url, p.brand,
             p.category_id, c.name AS category_name
      FROM products p
      JOIN sellers s ON s.id = p.seller_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE s.user_id = $1
      ORDER BY p.created_at DESC
    `, [auth.user.id]);
    return response.json(result.rows);
  } catch (error) {
    console.error("Seller product fetch failed:", error.message);
    return response.status(500).json({ message: "Unable to load your products." });
  }
});

app.get("/api/seller/orders", async (request, response) => {
  const auth = await requireUser(request, response, "seller");
  if (!auth) return;

  try {
    const result = await pool.query(`
      SELECT o.id AS order_id, buyer.full_name AS buyer_name,
             p.name AS product_name, oi.quantity, oi.subtotal,
             o.total_amount, o.status, o.created_at
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id
      JOIN sellers s ON s.id = p.seller_id
      JOIN users buyer ON buyer.id = o.user_id
      WHERE s.user_id = $1
      ORDER BY o.created_at DESC
    `, [auth.user.id]);
    return response.json(result.rows);
  } catch (error) {
    console.error("Seller order fetch failed:", error.message);
    return response.status(500).json({ message: "Unable to load your orders." });
  }
});

app.get("/api/cart", async (request, response) => {
  const auth = await requireUser(request, response, "buyer");
  if (!auth) return;

  try {
    return response.json(await getCartSummary(auth.user.id));
  } catch (error) {
    console.error("Cart fetch failed:", error.message);
    return response.status(500).json({ message: "Unable to load cart." });
  }
});

app.post("/api/cart/items", async (request, response) => {
  const auth = await requireUser(request, response, "buyer");
  if (!auth) return;

  const productId = Number(request.body?.product_id);
  const quantity = Number(request.body?.quantity ?? 1);
  if (!Number.isSafeInteger(productId) || productId <= 0 ||
      !Number.isSafeInteger(quantity) || quantity <= 0) {
    return response.status(400).json({ message: "Invalid product or quantity." });
  }

  try {
    const productResult = await pool.query(
      "SELECT id, price, stock FROM products WHERE id = $1 LIMIT 1",
      [productId]
    );
    const product = productResult.rows[0];
    if (!product) return response.status(404).json({ message: "Product not found." });

    const cartId = await ensureBuyerCart(auth.user.id);
    const existingResult = await pool.query(
      "SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2 LIMIT 1",
      [cartId, productId]
    );
    const existing = existingResult.rows[0];
    const nextQuantity = Number(existing?.quantity || 0) + quantity;
    if (nextQuantity > Number(product.stock)) {
      return response.status(400).json({ message: "Requested quantity exceeds available stock." });
    }

    if (existing) {
      await pool.query(
        "UPDATE cart_items SET quantity = $1, price = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
        [nextQuantity, product.price, existing.id]
      );
    } else {
      await pool.query(
        "INSERT INTO cart_items (cart_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)",
        [cartId, productId, quantity, product.price]
      );
    }

    return response.status(201).json({ message: "Added to cart." });
  } catch (error) {
    console.error("Add to cart failed:", error.message);
    return response.status(500).json({ message: "Unable to add item to cart." });
  }
});

app.put("/api/cart/items/:itemId", async (request, response) => {
  const auth = await requireUser(request, response, "buyer");
  if (!auth) return;

  const itemId = Number(request.params.itemId);
  const quantity = Number(request.body?.quantity);
  if (!Number.isSafeInteger(itemId) || itemId <= 0 ||
      !Number.isSafeInteger(quantity) || quantity <= 0) {
    return response.status(400).json({ message: "Invalid cart item or quantity." });
  }

  try {
    const cartId = await ensureBuyerCart(auth.user.id);
    const itemResult = await pool.query(`
      SELECT ci.id, p.stock, p.price
      FROM cart_items ci
      JOIN products p ON p.id = ci.product_id
      WHERE ci.id = $1 AND ci.cart_id = $2
      LIMIT 1
    `, [itemId, cartId]);
    const item = itemResult.rows[0];
    if (!item) return response.status(404).json({ message: "Cart item not found." });
    if (quantity > Number(item.stock)) {
      return response.status(400).json({ message: "Requested quantity exceeds available stock." });
    }

    await pool.query(
      "UPDATE cart_items SET quantity = $1, price = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
      [quantity, item.price, itemId]
    );
    return response.json({ message: "Cart updated." });
  } catch (error) {
    console.error("Cart update failed:", error.message);
    return response.status(500).json({ message: "Unable to update cart." });
  }
});

app.delete("/api/cart/items/:itemId", async (request, response) => {
  const auth = await requireUser(request, response, "buyer");
  if (!auth) return;

  const itemId = Number(request.params.itemId);
  if (!Number.isSafeInteger(itemId) || itemId <= 0) {
    return response.status(400).json({ message: "Invalid cart item." });
  }

  try {
    const cartId = await ensureBuyerCart(auth.user.id);
    const result = await pool.query(
      "DELETE FROM cart_items WHERE id = $1 AND cart_id = $2",
      [itemId, cartId]
    );
    if (!result.rowCount) return response.status(404).json({ message: "Cart item not found." });
    return response.json({ message: "Item removed from cart." });
  } catch (error) {
    console.error("Cart item removal failed:", error.message);
    return response.status(500).json({ message: "Unable to remove item from cart." });
  }
});

app.delete("/api/cart", async (request, response) => {
  const auth = await requireUser(request, response, "buyer");
  if (!auth) return;

  try {
    const cartId = await ensureBuyerCart(auth.user.id);
    await pool.query("DELETE FROM cart_items WHERE cart_id = $1", [cartId]);
    return response.json({ message: "Cart cleared." });
  } catch (error) {
    console.error("Cart clear failed:", error.message);
    return response.status(500).json({ message: "Unable to clear cart." });
  }
});

app.get("/api/wishlist", async (request, response) => {
  const auth = await requireUser(request, response, "buyer");
  if (!auth) return;

  try {
    const result = await pool.query(`
      SELECT wi.id, wi.product_id, p.name, p.description, p.price, p.image_url, c.name AS category_name
      FROM wishlist_items wi
      JOIN products p ON p.id = wi.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE wi.buyer_id = $1
      ORDER BY wi.created_at DESC
    `, [auth.user.id]);

    return response.json(result.rows);
  } catch (error) {
    console.error("Wishlist fetch failed:", error.message);
    return response.status(500).json({ message: "Unable to load wishlist." });
  }
});

app.post("/api/wishlist", async (request, response) => {
  const auth = await requireUser(request, response, "buyer");
  if (!auth) return;

  const productId = Number(request.body?.product_id);
  if (!Number.isFinite(productId) || productId <= 0) {
    return response.status(400).json({ message: "Invalid product." });
  }

  try {
    const productExists = await pool.query("SELECT id FROM products WHERE id = $1 LIMIT 1", [productId]);
    if (!productExists.rows[0]) {
      return response.status(404).json({ message: "Product not found." });
    }

    const exists = await pool.query(
      "SELECT id FROM wishlist_items WHERE buyer_id = $1 AND product_id = $2 LIMIT 1",
      [auth.user.id, productId]
    );

    if (exists.rows[0]) {
      return response.status(200).json({ message: "Product already saved to wishlist." });
    }

    const result = await pool.query(
      "INSERT INTO wishlist_items (buyer_id, product_id) VALUES ($1, $2) RETURNING *",
      [auth.user.id, productId]
    );

    return response.status(201).json({ message: "Added to wishlist.", item: result.rows[0] });
  } catch (error) {
    console.error("Wishlist save failed:", error.message);
    return response.status(500).json({ message: "Unable to save wishlist item." });
  }
});

app.delete("/api/wishlist/:productId", async (request, response) => {
  const auth = await requireUser(request, response, "buyer");
  if (!auth) return;

  const productId = Number(request.params.productId);
  if (!Number.isFinite(productId)) {
    return response.status(400).json({ message: "Invalid product id." });
  }

  try {
    const result = await pool.query(
      "DELETE FROM wishlist_items WHERE buyer_id = $1 AND product_id = $2",
      [auth.user.id, productId]
    );

    if (result.rowCount === 0) {
      return response.status(404).json({ message: "Wishlist item not found." });
    }

    return response.json({ message: "Removed from wishlist." });
  } catch (error) {
    console.error("Wishlist delete failed:", error.message);
    return response.status(500).json({ message: "Unable to remove wishlist item." });
  }
});

app.get("/api/orders", async (request, response) => {
  const auth = await requireUser(request, response, "buyer");
  if (!auth) return;

  try {
    const result = await pool.query(`
      SELECT o.id, o.total_amount, o.status, o.created_at,
             COALESCE(json_agg(json_build_object(
               'product_id', p.id,
               'product_name', p.name,
               'quantity', oi.quantity,
               'price', oi.price,
               'subtotal', oi.subtotal
             ) ORDER BY p.name), '[]'::json) AS items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE o.user_id = $1
      GROUP BY o.id, o.total_amount, o.status, o.created_at
      ORDER BY o.created_at DESC
    `, [auth.user.id]);

    return response.json(result.rows);
  } catch (error) {
    console.error("Order fetch failed:", error.message);
    return response.status(500).json({ message: "Unable to load your orders." });
  }
});

app.get("/api/orders/:id", async (request, response) => {
  const auth = await requireUser(request, response, "buyer");
  if (!auth) return;

  try {
    const result = await pool.query(`
      SELECT o.*, 
             COALESCE(json_agg(json_build_object(
               'product_id', p.id,
               'product_name', p.name,
               'quantity', oi.quantity,
               'price', oi.price,
               'subtotal', oi.subtotal
             ) ORDER BY p.name), '[]'::json) AS items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE o.id = $1 AND o.user_id = $2
      GROUP BY o.id
    `, [request.params.id, auth.user.id]);

    if (!result.rows[0]) {
      return response.status(404).json({ message: "Order not found." });
    }

    return response.json(result.rows[0]);
  } catch (error) {
    console.error("Single order fetch failed:", error.message);
    return response.status(500).json({ message: "Unable to load order." });
  }
});

app.post("/api/orders", async (request, response) => {
  const auth = await requireUser(request, response, "buyer");
  if (!auth) return;

  try {
    const cart = await getCartSummary(auth.user.id);
    if (!cart.items.length) {
      return response.status(400).json({ message: "Your cart is empty." });
    }

    const paymentMethod = String(request.body?.payment_method || "Cash on Delivery").trim() || "Cash on Delivery";
    const paymentStatus = String(request.body?.payment_status || "paid").trim() || "paid";

    let total = 0;
    const itemRecords = [];

    for (const item of cart.items) {
      const product = await pool.query(
        "SELECT id, name, stock, seller_id, price FROM products WHERE id = $1 LIMIT 1",
        [item.product_id]
      );

      const productRow = product.rows[0];
      if (!productRow) {
        return response.status(404).json({ message: `Product ${item.product_id} no longer exists.` });
      }

      if (Number(productRow.stock) < Number(item.quantity)) {
        return response.status(400).json({ message: `${productRow.name} has insufficient stock.` });
      }

      total += Number(productRow.price) * Number(item.quantity);
      itemRecords.push({
        product_id: productRow.id,
        seller_id: productRow.seller_id,
        quantity: Number(item.quantity),
        price: Number(productRow.price),
        subtotal: Number(productRow.price) * Number(item.quantity)
      });
    }

    const createOrder = await pool.query(
      "INSERT INTO orders (user_id, total_amount, status) VALUES ($1, $2, 'confirmed') RETURNING *",
      [auth.user.id, Number(total.toFixed(2))]
    );

    const order = createOrder.rows[0];
    const orderItemInsertions = [];

    for (const item of itemRecords) {
      const insert = await pool.query(
        `INSERT INTO order_items (order_id, product_id, seller_id, quantity, price, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [order.id, item.product_id, item.seller_id, item.quantity, item.price, item.subtotal]
      );
      orderItemInsertions.push(insert.rows[0]);

      await pool.query(
        "UPDATE products SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [item.quantity, item.product_id]
      );
    }

    const paymentRef = `demo-${Date.now()}-${order.id}`;
    await pool.query(
      "INSERT INTO payments (order_id, payment_method, payment_status, amount, transaction_reference) VALUES ($1, $2, $3, $4, $5)",
      [order.id, paymentMethod, paymentStatus, Number(total.toFixed(2)), paymentRef]
    );

    await pool.query("DELETE FROM cart_items WHERE cart_id = $1", [cart.cart_id]);

    return response.status(201).json({
      message: "Order placed successfully.",
      order: { ...order, items: orderItemInsertions },
      payment_reference: paymentRef
    });
  } catch (error) {
    console.error("Checkout failed:", error.message);
    return response.status(500).json({ message: "Unable to place order." });
  }
});

app.get("/api/health", async (_request, response) => {
  try {
    await pool.query("SELECT 1");
    response.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("Database health check failed:", error.message);
    response.status(503).json({ status: "error", database: "disconnected" });
  }
});

async function startServer() {
  await ensureDatabaseSchema();
  app.listen(PORT, () => {
    console.log(`SIVA_MART login server is running at http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Server failed to start:", error.message);
  process.exit(1);
});
