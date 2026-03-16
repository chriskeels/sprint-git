const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

function loadEnvFile(fileName, override = false) {
  const filePath = path.join(process.cwd(), fileName);

  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (override || !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local", true);

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Add it to .env or .env.local before running db:init."
  );
}

const pool = new Pool({
  connectionString: (function () {
    const url = process.env.DATABASE_URL;
    try {
      const parsed = new URL(url);
      parsed.searchParams.delete("sslmode");
      parsed.searchParams.delete("uselibpqcompat");
      return parsed.toString();
    } catch {
      return url;
    }
  })(),
  ssl:
    !process.env.DATABASE_URL.includes("localhost") &&
    !process.env.DATABASE_URL.includes("127.0.0.1")
      ? { rejectUnauthorized: false }
      : false,
});

async function init() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('student', 'mentor')),
        monthly_budget DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
        category VARCHAR(50) NOT NULL,
        description TEXT,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS savings_goals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(100) NOT NULL,
        target_amount DECIMAL(10,2) NOT NULL,
        current_amount DECIMAL(10,2) DEFAULT 0,
        emoji VARCHAR(10) DEFAULT '🎯',
        deadline DATE,
        is_completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS streaks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        current_streak INT DEFAULT 0,
        longest_streak INT DEFAULT 0,
        last_activity_date DATE,
        total_days INT DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_savings_goals_user_id ON savings_goals(user_id);
    `);
    console.log("✅ Database initialized successfully!");
  } catch (err) {
    console.error("❌ DB init error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

init();
