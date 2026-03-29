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
    {
      sql: `CREATE TABLE IF NOT EXISTS analyses_log (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER,
        ip         TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
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

export async function dbDecrementCreditosN(userId: number, n: number): Promise<boolean> {
  await initDb()
  const res = await db.execute({
    sql: 'UPDATE users SET creditos = creditos - ? WHERE id = ? AND creditos >= ?',
    args: [n, userId, n],
  })
  return (res.rowsAffected ?? 0) > 0
}

export async function dbAddCreditos(email: string, count: number): Promise<void> {
  await initDb()
  await db.execute({
    sql: 'UPDATE users SET creditos = creditos + ? WHERE email = ?',
    args: [count, email],
  })
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

// ── Analyses log ─────────────────────────────────────────────────────────────

export async function dbLogAnalysis(userId: number | null, ip: string): Promise<void> {
  await initDb()
  await db.execute({
    sql: 'INSERT INTO analyses_log (user_id, ip) VALUES (?, ?)',
    args: [userId, ip],
  })
}

// ── Admin helpers ─────────────────────────────────────────────────────────────

export async function dbAdminGetStats() {
  await initDb()
  const [r1, r2, r3, r4] = await Promise.all([
    db.execute({ sql: 'SELECT COUNT(*) as n FROM users WHERE ativo = 1', args: [] }),
    db.execute({ sql: "SELECT COUNT(*) as n FROM analyses_log WHERE created_at >= datetime('now', 'start of day')", args: [] }),
    db.execute({ sql: "SELECT COUNT(*) as n FROM users WHERE created_at >= datetime('now', '-7 days')", args: [] }),
    db.execute({ sql: 'SELECT COUNT(*) as n FROM users', args: [] }),
  ])
  const active = Number(r1.rows[0].n)
  return {
    activeUsers: active,
    analysesToday: Number(r2.rows[0].n),
    newUsersThisWeek: Number(r3.rows[0].n),
    totalUsers: Number(r4.rows[0].n),
    revenueEstimated: active * 57.9,
  }
}

export type AdminUser = User & { last_analysis: string | null }

export async function dbAdminGetUsers(search: string, offset: number, limit: number): Promise<AdminUser[]> {
  await initDb()
  const like = `%${search}%`
  const res = await db.execute({
    sql: `SELECT u.id, u.email, u.name, u.plano, u.analises, u.creditos, u.ativo,
                 u.kirvano_id, u.created_at, u.hash,
                 (SELECT MAX(al.created_at) FROM analyses_log al WHERE al.user_id = u.id) as last_analysis
          FROM users u
          WHERE u.email LIKE ? OR COALESCE(u.name, '') LIKE ?
          ORDER BY u.created_at DESC
          LIMIT ? OFFSET ?`,
    args: [like, like, limit, offset],
  })
  return res.rows.map((r) => {
    const row = r as Record<string, unknown>
    return {
      ...rowToUser(row),
      last_analysis: (row.last_analysis as string) ?? null,
    }
  })
}

export async function dbAdminCountUsers(search: string): Promise<number> {
  await initDb()
  const like = `%${search}%`
  const res = await db.execute({
    sql: "SELECT COUNT(*) as n FROM users WHERE email LIKE ? OR COALESCE(name, '') LIKE ?",
    args: [like, like],
  })
  return Number(res.rows[0].n)
}

export async function dbAdminAddAnalises(userId: number, count: number): Promise<void> {
  await initDb()
  await db.execute({
    sql: 'UPDATE users SET analises = analises + ? WHERE id = ?',
    args: [count, userId],
  })
}

export async function dbAdminAddCreditos(userId: number, count: number): Promise<void> {
  await initDb()
  await db.execute({
    sql: 'UPDATE users SET creditos = creditos + ? WHERE id = ?',
    args: [count, userId],
  })
}

export async function dbAdminSetAtivo(userId: number, ativo: number): Promise<void> {
  await initDb()
  await db.execute({
    sql: "UPDATE users SET ativo = ?, plano = CASE WHEN ? = 1 THEN 'pro' ELSE 'inativo' END WHERE id = ?",
    args: [ativo, ativo, userId],
  })
}

export async function dbAdminDeleteUser(userId: number): Promise<void> {
  await initDb()
  await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [userId] })
}

export default db
