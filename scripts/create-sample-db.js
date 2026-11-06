import Database from "better-sqlite3";
import { resolve } from "node:path";
import { unlinkSync, existsSync } from "node:fs";

const dbPath = resolve(process.cwd(), "test-demo.db");
if (existsSync(dbPath)) {
  unlinkSync(dbPath);
}

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE INDEX idx_orders_user_id ON orders(user_id);
`);

const insertUser = db.prepare("INSERT INTO users (username, email) VALUES (?, ?)");
for (let i = 1; i <= 20; i++) {
  insertUser.run(`user_${i}`, `user_${i}@example.com`);
}

const insertOrder = db.prepare("INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, ?)");
for (let i = 1; i <= 100; i++) {
  insertOrder.run((i % 20) + 1, (i * 12.5), i % 2 === 0 ? "completed" : "pending");
}

console.log(`Created sample SQLite DB at: ${dbPath}`);
db.close();
