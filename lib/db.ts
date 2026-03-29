import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DATA_DIR = path.join(process.cwd(), 'data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

const DB_PATH = path.join(DATA_DIR, 'clickclone.db')
const db = new Database(DB_PATH)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT    NOT NULL UNIQUE,
    name        TEXT,
    hash        TEXT,
    plano       TEXT    NOT NULL DEFAULT 'pro',
    analises    INTEGER NOT NULL DEFAULT 20,
    creditos    INTEGER NOT NULL DEFAULT 100,
    ativo       INTEGER NOT NULL DEFAULT 1,
    kirvano_id  TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`)

export type User = {
  id: number
  email: string
  name: string | null
  hash: string | null
  plano: string
  analises: number
  creditos: number
  ativo: number
  kirvano_id: string | null
  created_at: string
}

export function dbGetUserByEmail(email: string): User | undefined {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined
}

export function dbGetUserById(id: number): User | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined
}

export function dbCreateUser(data: {
  email: string
  name?: string
  hash?: string
  kirvano_id?: string
}): User {
  const stmt = db.prepare(
    'INSERT INTO users (email, name, hash, kirvano_id) VALUES (?, ?, ?, ?) RETURNING *'
  )
  return stmt.get(data.email, data.name ?? null, data.hash ?? null, data.kirvano_id ?? null) as User
}

export function dbSetHash(email: string, hash: string) {
  db.prepare('UPDATE users SET hash = ? WHERE email = ?').run(hash, email)
}

export function dbActivateUser(kirvano_id: string, email: string, name: string) {
  const existing = dbGetUserByEmail(email)
  if (existing) {
    db.prepare('UPDATE users SET ativo = 1, kirvano_id = ?, name = ? WHERE email = ?')
      .run(kirvano_id, name, email)
    return dbGetUserByEmail(email)!
  }
  return dbCreateUser({ email, name, kirvano_id })
}

export function dbDecrementCreditos(userId: number): boolean {
  const result = db
    .prepare('UPDATE users SET creditos = creditos - 1 WHERE id = ? AND creditos > 0')
    .run(userId)
  return result.changes > 0
}

export function dbDecrementAnalises(userId: number): boolean {
  const result = db
    .prepare('UPDATE users SET analises = analises - 1 WHERE id = ? AND analises > 0')
    .run(userId)
  return result.changes > 0
}

export default db
