import { Pool } from 'pg';
import 'dotenv/config';

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function initializeDatabase(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         VARCHAR(255) PRIMARY KEY,
      name       VARCHAR(255) NOT NULL,
      phone      VARCHAR(50),
      cpf        VARCHAR(50),
      email      VARCHAR(255) UNIQUE NOT NULL,
      password   VARCHAR(255) NOT NULL,
      referral   VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id          VARCHAR(255) PRIMARY KEY,
      user_id     VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title       VARCHAR(255) NOT NULL,
      description TEXT,
      due_date    TIMESTAMP,
      tag         VARCHAR(50),
      image_url   TEXT,
      column_id   VARCHAR(50) NOT NULL DEFAULT 'todo',
      completed   BOOLEAN NOT NULL DEFAULT FALSE,
      position    INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS board_shares (
      id             VARCHAR(255) PRIMARY KEY,
      owner_id       VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      shared_with_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(owner_id, shared_with_id)
    );
  `);
}
