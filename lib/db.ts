import { createClient } from '@libsql/client'

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
})

// Run once on cold start to ensure schema exists
let initialized = false
export async function initDb() {
  if (initialized) return
  await db.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS users (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        email       TEXT    NOT NULL UNIQUE,
        name        TEXT,
        hash        TEXT,
        plano       TEXT    NOT NULL DEFAULT 'pro',
        analises    INTEGER NOT NULL DEFAULT 10,
        creditos    INTEGER NOT NULL DEFAULT 100,
        ativo       INTEGER NOT NULL DEFAULT 1,
        kirvano_id  TEXT,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS free_usage (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        ip              TEXT NOT NULL,
        session_id      TEXT NOT NULL,
        analises_usadas INTEGER NOT NULL DEFAULT 0,
        creditos_usados INTEGER NOT NULL DEFAULT 0,
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(ip, session_id)
      )`,
      args: [],
    },
  ])
  initialized = true
}

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

export type FreeUsage = {
  id: number
  ip: string
  session_id: string
  analises_usadas: number
  creditos_usados: number
  created_at: string
}

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as number,
    email: row.email as string,
    name: (row.name as string) ?? null,
    hash: (row.hash as string) ?? null,
    plano: row.plano as string,
    analises: row.analises as number,
    creditos: row.creditos as number,
    ativo: row.ativo as number,
    kirvano_id: (row.kirvano_id as string) ?? null,
    created_at: row.created_at as string,
  }
}

export async function dbGetUserByEmail(email: string): Promise<User | undefined> {
  await initDb()
  const res = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] })
  if (!res.rows[0]) return undefined
  return rowToUser(res.rows[0] as Record<string, unknown>)
}

export async function dbGetUserById(id: number): Promise<User | undefined> {
  await initDb()
  const res = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] })
  if (!res.rows[0]) return undefined
  return rowToUser(res.rows[0] as Record<string, unknown>)
}

export async function dbCreateUser(data: {
  email: string
  name?: string
  hash?: string
  kirvano_id?: string
}): Promise<User> {
  await initDb()
  await db.execute({
    sql: 'INSERT INTO users (email, name, hash, kirvano_id) VALUES (?, ?, ?, ?)',
    args: [data.email, data.name ?? null, data.hash ?? null, data.kirvano_id ?? null],
  })
  return (await dbGetUserByEmail(data.email))!
}

export async function dbSetHash(email: string, hash: string) {
  await initDb()
  await db.execute({ sql: 'UPDATE users SET hash = ? WHERE email = ?', args: [hash, email] })
}

export async function dbActivateUser(kirvano_id: string, email: string, name: string, hash?: string): Promise<User> {
  await initDb()
  const existing = await dbGetUserByEmail(email)
  if (existing) {
    await db.execute({
      sql: 'UPDATE users SET ativo = 1, plano = ?, analises = 10, creditos = 100, kirvano_id = ?, name = ? WHERE email = ?',
      args: ['pro', kirvano_id, name, email],
    })
    return (await dbGetUserByEmail(email))!
  }
  return dbCreateUser({ email, name, kirvano_id, hash })
}

export async function dbRenewUser(email: string): Promise<void> {
  await initDb()
  await db.execute({
    sql: 'UPDATE users SET ativo = 1, plano = ?, analises = 10, creditos = 100 WHERE email = ?',
    args: ['pro', email],
  })
}

export async function dbDeactivateUser(email: string): Promise<void> {
  await initDb()
  await db.execute({
    sql: "UPDATE users SET plano = 'inativo', ativo = 0 WHERE email = ?",
    args: [email],
  })
}

export async function dbDecrementCreditos(userId: number): Promise<boolean> {
  await initDb()
  const res = await db.execute({
    sql: 'UPDATE users SET creditos = creditos - 1 WHERE id = ? AND creditos > 0',
    args: [userId],
  })
  return (res.rowsAffected ?? 0) > 0
}

export async function dbDecrementAnalises(userId: number): Promise<boolean> {
  await initDb()
  const res = await db.execute({
    sql: 'UPDATE users SET analises = analises - 1 WHERE id = ? AND analises > 0',
    args: [userId],
  })
  return (res.rowsAffected ?? 0) > 0
}

// ── Free usage (usuários sem conta) ─────────────────────────────────────────

export async function dbGetFreeUsage(ip: string, sessionId: string): Promise<FreeUsage | null> {
  await initDb()
  const res = await db.execute({
    sql: 'SELECT * FROM free_usage WHERE ip = ? AND session_id = ?',
    args: [ip, sessionId],
  })
  if (!res.rows[0]) return null
  const r = res.rows[0] as Record<string, unknown>
  return {
    id: r.id as number,
    ip: r.ip as string,
    session_id: r.session_id as string,
    analises_usadas: r.analises_usadas as number,
    creditos_usados: r.creditos_usados as number,
    created_at: r.created_at as string,
  }
}

export async function dbIncrementFreeAnalises(ip: string, sessionId: string): Promise<void> {
  await initDb()
  await db.execute({
    sql: `INSERT INTO free_usage (ip, session_id, analises_usadas, creditos_usados)
          VALUES (?, ?, 1, 0)
          ON CONFLICT(ip, session_id) DO UPDATE SET analises_usadas = analises_usadas + 1`,
    args: [ip, sessionId],
  })
}

export async function dbIncrementFreeCreditos(ip: string, sessionId: string): Promise<void> {
  await initDb()
  await db.execute({
    sql: `INSERT INTO free_usage (ip, session_id, analises_usadas, creditos_usados)
          VALUES (?, ?, 0, 1)
          ON CONFLICT(ip, session_id) DO UPDATE SET creditos_usados = creditos_usados + 1`,
    args: [ip, sessionId],
  })
}

export default db
