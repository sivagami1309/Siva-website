require("dotenv").config();
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "siva_mart",
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD
});

async function createAdmin() {
  try {
    const email = "admin@sivamart.com";
    const password = "SivaAdmin@2026";
    const fullName = "Siva Mart Admin";

    const existing = await pool.query(
      "SELECT id, role FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    if (existing.rows.length > 0) {
      console.log(
        `An account already exists with this email. Role: ${existing.rows[0].role}`
      );
      console.log("No changes were made.");
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)`,
      [fullName, email, passwordHash, "admin"]
    );

    console.log("Admin account created successfully.");
    console.log("Email: " + email);
  } catch (error) {
    console.error("Admin setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

createAdmin();