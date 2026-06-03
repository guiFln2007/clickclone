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
    {
      sql: `CREATE TABLE IF NOT EXISTS analysis_cache (
        page_id    TEXT NOT NULL PRIMARY KEY,
        analysis   TEXT NOT NULL,
        html       TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS tracked_offers (
        id                     TEXT PRIMARY KEY,
        user_id                INTEGER NOT NULL,
        pagina_nome            TEXT NOT NULL,
        page_id                TEXT,
        ad_library_url         TEXT NOT NULL,
        landing_url            TEXT,
        nicho                  TEXT,
        primeiro_snapshot_ads  INTEGER,
        ultimo_snapshot_ads    INTEGER,
        primeiro_snapshot_data TEXT,
        ultimo_snapshot_data   TEXT,
        landing_hash           TEXT,
        status                 TEXT NOT NULL DEFAULT 'ativa',
        alertas_nao_lidos      INTEGER NOT NULL DEFAULT 0,
        criado_em              TEXT NOT NULL DEFAULT (datetime('now')),
        verificado_em          TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS offer_alerts (
        id                TEXT PRIMARY KEY,
        tracked_offer_id  TEXT NOT NULL,
        tipo              TEXT NOT NULL,
        mensagem          TEXT NOT NULL,
        dados_anteriores  TEXT,
        dados_novos       TEXT,
        lido              INTEGER NOT NULL DEFAULT 0,
        criado_em         TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (tracked_offer_id) REFERENCES tracked_offers(id)
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS offer_snapshots (
        id                 TEXT PRIMARY KEY,
        tracked_offer_id   TEXT NOT NULL,
        ads_count          INTEGER NOT NULL,
        variacao           INTEGER NOT NULL DEFAULT 0,
        variacao_percent   REAL NOT NULL DEFAULT 0,
        registrado_em      TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (tracked_offer_id) REFERENCES tracked_offers(id)
      )`,
      args: [],
    },
  ])

  // Index for snapshot lookups by offer
  try {
    await db.execute('CREATE INDEX IF NOT EXISTS idx_snapshots_offer ON offer_snapshots (tracked_offer_id, registrado_em)')
  } catch { /* already exists */ }

  // Migration: add page_id column to existing tracked_offers table
  try {
    await db.execute('ALTER TABLE tracked_offers ADD COLUMN page_id TEXT')
  } catch { /* column already exists */ }

  // Migration: add quota fields for plan system
  const migrations = [
    'ALTER TABLE users ADD COLUMN mineracoes INTEGER NOT NULL DEFAULT 5',
    'ALTER TABLE users ADD COLUMN max_analises INTEGER NOT NULL DEFAULT 5',
    'ALTER TABLE users ADD COLUMN max_mineracoes INTEGER NOT NULL DEFAULT 5',
    'ALTER TABLE users ADD COLUMN max_slots_radar INTEGER NOT NULL DEFAULT 5',
    'ALTER TABLE users ADD COLUMN renova_em TEXT',
  ]
  for (const sql of migrations) {
    try { await db.execute(sql) } catch { /* column already exists */ }
  }

  // Migration: leads table
  try {
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS leads (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        email      TEXT NOT NULL UNIQUE,
        source     TEXT NOT NULL DEFAULT 'popup',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      args: [],
    })
  } catch { /* exists */ }

  // Migration: track trial nurture emails sent
  try { await db.execute('ALTER TABLE users ADD COLUMN trial_email_sent TEXT') } catch { /* exists */ }

  // Migration: track trial signup IP
  try { await db.execute('ALTER TABLE users ADD COLUMN trial_ip TEXT') } catch { /* exists */ }

  // Migration: ManyChat slug tracking on users
  try { await db.execute('ALTER TABLE users ADD COLUMN mc_slug TEXT') } catch { /* exists */ }

  // Migration: swipe expiration for curso trial
  try { await db.execute('ALTER TABLE users ADD COLUMN swipe_expires_at TEXT') } catch { /* exists */ }

  // Migration: visitor_sessions table for real-time tracking
  try {
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS visitor_sessions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id  TEXT NOT NULL UNIQUE,
        user_id     INTEGER,
        email       TEXT,
        page        TEXT NOT NULL DEFAULT '/',
        referrer    TEXT,
        utm_source  TEXT,
        utm_medium  TEXT,
        utm_campaign TEXT,
        ip          TEXT,
        user_agent  TEXT,
        device      TEXT,
        started_at  TEXT NOT NULL DEFAULT (datetime('now')),
        last_seen   TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      args: [],
    })
  } catch { /* exists */ }

  // Migration: page_views log for tracking history
  try {
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS page_views (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id  TEXT NOT NULL,
        user_id     INTEGER,
        page        TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      args: [],
    })
  } catch { /* exists */ }

  // Migration: auto_mined_offers for 24/7 mining feed
  try {
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS auto_mined_offers (
        id              TEXT PRIMARY KEY,
        page_name       TEXT NOT NULL,
        page_id         TEXT NOT NULL UNIQUE,
        ad_count        INTEGER NOT NULL DEFAULT 0,
        landing_url     TEXT,
        thumbnail_url   TEXT,
        creative_urls   TEXT,
        nicho           TEXT,
        keyword_source  TEXT,
        dias_rodando    INTEGER,
        first_seen      TEXT NOT NULL DEFAULT (datetime('now')),
        last_seen       TEXT NOT NULL DEFAULT (datetime('now')),
        status          TEXT NOT NULL DEFAULT 'ativa'
      )`,
      args: [],
    })
  } catch { /* exists */ }
  // Migration: add enrichment fields
  for (const col of [
    'ALTER TABLE auto_mined_offers ADD COLUMN enriched INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE auto_mined_offers ADD COLUMN ig_handle TEXT',
    'ALTER TABLE auto_mined_offers ADD COLUMN ig_followers INTEGER',
    'ALTER TABLE auto_mined_offers ADD COLUMN fb_followers INTEGER',
    'ALTER TABLE auto_mined_offers ADD COLUMN landing_screenshot TEXT',
    'ALTER TABLE auto_mined_offers ADD COLUMN ad_copies TEXT',
  ]) { try { await db.execute(col) } catch { /* exists */ } }

  // Migration: mc_clicks table for ManyChat tracking
  try {
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS mc_clicks (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        slug        TEXT NOT NULL,
        ip          TEXT,
        user_agent  TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      args: [],
    })
  } catch { /* exists */ }

  initialized = true
}

// Plan definitions — single source of truth
export const PLANS: Record<string, { analises: number; mineracoes: number; slots_radar: number; label: string; periodo: string; dias: number }> = {
  trial: { analises: 1, mineracoes: 1, slots_radar: 1, label: 'Trial', periodo: 'teste', dias: 30 },
  curso: { analises: 3, mineracoes: 3, slots_radar: 3, label: 'Curso', periodo: 'teste', dias: 0 },
  starter: { analises: 10, mineracoes: 10, slots_radar: 10, label: 'Starter', periodo: 'mensal', dias: 30 },
  premium: { analises: 20, mineracoes: 20, slots_radar: 20, label: 'Premium', periodo: 'trimestral', dias: 90 },
}

export type User = {
  id: number
  email: string
  name: string | null
  hash: string | null
  plano: string
  analises: number
  mineracoes: number
  creditos: number
  max_analises: number
  max_mineracoes: number
  max_slots_radar: number
  ativo: number
  kirvano_id: string | null
  renova_em: string | null
  trial_email_sent: string | null
  swipe_expires_at: string | null
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
    mineracoes: (row.mineracoes as number) ?? 5,
    creditos: row.creditos as number,
    max_analises: (row.max_analises as number) ?? 5,
    max_mineracoes: (row.max_mineracoes as number) ?? 5,
    max_slots_radar: (row.max_slots_radar as number) ?? 5,
    ativo: row.ativo as number,
    kirvano_id: (row.kirvano_id as string) ?? null,
    renova_em: (row.renova_em as string) ?? null,
    trial_email_sent: (row.trial_email_sent as string) ?? null,
    swipe_expires_at: (row.swipe_expires_at as string) ?? null,
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

export async function dbActivateUser(kirvano_id: string, email: string, name: string, hash?: string, plano = 'starter'): Promise<User> {
  await initDb()
  const plan = PLANS[plano] || PLANS.starter
  const renovaEm = new Date(Date.now() + plan.dias * 86400000).toISOString()

  const existing = await dbGetUserByEmail(email)
  if (existing) {
    await db.execute({
      sql: `UPDATE users SET ativo = 1, plano = ?, analises = ?, mineracoes = ?,
            max_analises = ?, max_mineracoes = ?, max_slots_radar = ?,
            creditos = 100, kirvano_id = ?, name = ?, renova_em = ?${hash ? ', hash = ?' : ''} WHERE email = ?`,
      args: hash
        ? [plano, plan.analises, plan.mineracoes, plan.analises, plan.mineracoes, plan.slots_radar, kirvano_id, name, renovaEm, hash, email]
        : [plano, plan.analises, plan.mineracoes, plan.analises, plan.mineracoes, plan.slots_radar, kirvano_id, name, renovaEm, email],
    })
    return (await dbGetUserByEmail(email))!
  }
  const user = await dbCreateUser({ email, name, kirvano_id, hash })
  await db.execute({
    sql: `UPDATE users SET plano = ?, analises = ?, mineracoes = ?,
          max_analises = ?, max_mineracoes = ?, max_slots_radar = ?,
          renova_em = ? WHERE id = ?`,
    args: [plano, plan.analises, plan.mineracoes, plan.analises, plan.mineracoes, plan.slots_radar, renovaEm, user.id],
  })
  return (await dbGetUserByEmail(email))!
}

export async function dbRenewUser(email: string, plano?: string): Promise<void> {
  await initDb()
  const existing = await dbGetUserByEmail(email)
  const planKey = plano || existing?.plano || 'starter'
  const plan = PLANS[planKey] || PLANS.starter
  const renovaEm = new Date(Date.now() + plan.dias * 86400000).toISOString()

  await db.execute({
    sql: `UPDATE users SET ativo = 1, plano = ?, analises = ?, mineracoes = ?,
          max_analises = ?, max_mineracoes = ?, max_slots_radar = ?,
          creditos = 100, renova_em = ? WHERE email = ?`,
    args: [planKey, plan.analises, plan.mineracoes, plan.analises, plan.mineracoes, plan.slots_radar, renovaEm, email],
  })
}

export async function dbSetSwipeExpiry(userId: number, expiresAt: string): Promise<void> {
  await initDb()
  await db.execute({ sql: 'UPDATE users SET swipe_expires_at = ? WHERE id = ?', args: [expiresAt, userId] })
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

export async function dbDecrementMineracoes(userId: number): Promise<boolean> {
  await initDb()
  const res = await db.execute({
    sql: 'UPDATE users SET mineracoes = mineracoes - 1 WHERE id = ? AND mineracoes > 0',
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

// ── Analysis cache ────────────────────────────────────────────────────────────

export async function dbGetCachedAnalysis(pageId: string): Promise<{ analysis: string; html: string } | null> {
  await initDb()
  const res = await db.execute({
    sql: "SELECT analysis, html FROM analysis_cache WHERE page_id = ? AND created_at >= datetime('now', '-72 hours')",
    args: [pageId],
  })
  if (!res.rows[0]) return null
  const row = res.rows[0] as Record<string, unknown>
  return { analysis: row.analysis as string, html: row.html as string }
}

export async function dbDeleteCachedAnalysis(pageId: string): Promise<void> {
  await initDb()
  // Show every stored page_id so we can spot mismatches
  const all = await db.execute({ sql: 'SELECT page_id, created_at FROM analysis_cache', args: [] })
  console.log('[Cache] Todos os registros:', all.rows.map(r => ({ page_id: r.page_id, created_at: r.created_at })))
  console.log('[Cache] DELETE tentando pageId:', JSON.stringify(pageId), '| tipo:', typeof pageId, '| length:', pageId.length)
  const result = await db.execute({ sql: 'DELETE FROM analysis_cache WHERE page_id = ?', args: [pageId] })
  console.log('[Cache] DELETE rowsAffected:', result.rowsAffected)
}

export async function dbSaveCachedAnalysis(pageId: string, analysis: string, html: string): Promise<void> {
  await initDb()
  await db.execute({
    sql: `INSERT INTO analysis_cache (page_id, analysis, html) VALUES (?, ?, ?)
          ON CONFLICT(page_id) DO UPDATE SET analysis = excluded.analysis, html = excluded.html, created_at = datetime('now')`,
    args: [pageId, analysis, html],
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
    sql: `SELECT u.id, u.email, u.name, u.plano, u.analises, u.mineracoes, u.creditos, u.ativo,
                 u.max_analises, u.max_mineracoes, u.max_slots_radar, u.renova_em,
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

// ── Trial nurture ────────────────────────────────────────────────────────────

export async function dbCheckTrialIp(ip: string): Promise<boolean> {
  await initDb()
  const res = await db.execute({
    sql: "SELECT COUNT(*) as n FROM users WHERE trial_ip = ? AND plano = 'trial'",
    args: [ip],
  })
  return Number(res.rows[0].n) > 0
}

export async function dbSetTrialIp(email: string, ip: string): Promise<void> {
  await initDb()
  await db.execute({ sql: 'UPDATE users SET trial_ip = ? WHERE email = ?', args: [ip, email] })
}

export async function dbSaveLead(email: string, source = 'popup'): Promise<boolean> {
  await initDb()
  try {
    await db.execute({
      sql: 'INSERT OR IGNORE INTO leads (email, source) VALUES (?, ?)',
      args: [email, source],
    })
    return true
  } catch {
    return false
  }
}

export async function dbGetTrialUsersForNurture(): Promise<User[]> {
  await initDb()
  const res = await db.execute({
    sql: `SELECT * FROM users WHERE plano = 'trial' AND ativo = 1`,
    args: [],
  })
  return res.rows.map(r => rowToUser(r as Record<string, unknown>))
}

export async function dbGetInactiveTrials(): Promise<User[]> {
  await initDb()
  const res = await db.execute({
    sql: `SELECT * FROM users WHERE plano IN ('trial', 'inativo') AND kirvano_id IS NULL`,
    args: [],
  })
  return res.rows.map(r => rowToUser(r as Record<string, unknown>))
}

export async function dbMarkTrialEmail(userId: number, emailType: string): Promise<void> {
  await initDb()
  // Append to comma-separated list
  await db.execute({
    sql: `UPDATE users SET trial_email_sent = CASE
            WHEN trial_email_sent IS NULL THEN ?
            ELSE trial_email_sent || ',' || ?
          END WHERE id = ?`,
    args: [emailType, emailType, userId],
  })
}

export async function dbAdminUpdateUser(userId: number, updates: {
  email?: string; name?: string; plano?: string; analises?: number; mineracoes?: number;
  max_analises?: number; max_mineracoes?: number; max_slots_radar?: number;
  creditos?: number; ativo?: number; renova_em?: string | null;
}): Promise<void> {
  await initDb()
  const sets: string[] = []
  const args: (string | number | null)[] = []
  for (const [key, val] of Object.entries(updates)) {
    if (val !== undefined) { sets.push(`${key} = ?`); args.push(val) }
  }
  if (sets.length === 0) return
  args.push(userId)
  await db.execute({ sql: `UPDATE users SET ${sets.join(', ')} WHERE id = ?`, args })
}

export async function dbAdminDeleteUser(userId: number): Promise<void> {
  await initDb()
  await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [userId] })
}

// ── Tracked offers (Radar) ───────────────────────────────────────────────────

export type TrackedOffer = {
  id: string
  user_id: number
  pagina_nome: string
  page_id: string | null
  ad_library_url: string
  landing_url: string | null
  nicho: string | null
  primeiro_snapshot_ads: number | null
  ultimo_snapshot_ads: number | null
  primeiro_snapshot_data: string | null
  ultimo_snapshot_data: string | null
  landing_hash: string | null
  status: string
  alertas_nao_lidos: number
  criado_em: string
  verificado_em: string | null
}

export type OfferAlert = {
  id: string
  tracked_offer_id: string
  tipo: string
  mensagem: string
  dados_anteriores: string | null
  dados_novos: string | null
  lido: number
  criado_em: string
}

export async function dbCreateTrackedOffer(data: {
  id: string
  user_id: number
  pagina_nome: string
  page_id?: string
  ad_library_url: string
  landing_url?: string
  nicho?: string
  primeiro_snapshot_ads?: number
  primeiro_snapshot_data?: string
}): Promise<void> {
  await initDb()
  await db.execute({
    sql: `INSERT INTO tracked_offers (id, user_id, pagina_nome, page_id, ad_library_url, landing_url, nicho, primeiro_snapshot_ads, ultimo_snapshot_ads, primeiro_snapshot_data, ultimo_snapshot_data)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO NOTHING`,
    args: [
      data.id, data.user_id, data.pagina_nome, data.page_id ?? null, data.ad_library_url,
      data.landing_url ?? null, data.nicho ?? null,
      data.primeiro_snapshot_ads ?? null, data.primeiro_snapshot_ads ?? null,
      data.primeiro_snapshot_data ?? null, data.primeiro_snapshot_data ?? null,
    ],
  })
}

export async function dbGetTrackedOffers(userId: number): Promise<TrackedOffer[]> {
  await initDb()
  const res = await db.execute({
    sql: 'SELECT * FROM tracked_offers WHERE user_id = ? ORDER BY criado_em DESC',
    args: [userId],
  })
  return res.rows.map(r => {
    const row = r as Record<string, unknown>
    return {
      id: row.id as string,
      user_id: row.user_id as number,
      pagina_nome: row.pagina_nome as string,
      page_id: (row.page_id as string) ?? null,
      ad_library_url: row.ad_library_url as string,
      landing_url: (row.landing_url as string) ?? null,
      nicho: (row.nicho as string) ?? null,
      primeiro_snapshot_ads: row.primeiro_snapshot_ads as number | null,
      ultimo_snapshot_ads: row.ultimo_snapshot_ads as number | null,
      primeiro_snapshot_data: (row.primeiro_snapshot_data as string) ?? null,
      ultimo_snapshot_data: (row.ultimo_snapshot_data as string) ?? null,
      landing_hash: (row.landing_hash as string) ?? null,
      status: row.status as string,
      alertas_nao_lidos: row.alertas_nao_lidos as number,
      criado_em: row.criado_em as string,
      verificado_em: (row.verificado_em as string) ?? null,
    }
  })
}

export async function dbDeleteTrackedOffer(offerId: string, userId: number): Promise<boolean> {
  await initDb()
  await db.execute({ sql: 'DELETE FROM offer_alerts WHERE tracked_offer_id = ?', args: [offerId] })
  const res = await db.execute({ sql: 'DELETE FROM tracked_offers WHERE id = ? AND user_id = ?', args: [offerId, userId] })
  return (res.rowsAffected ?? 0) > 0
}

export async function dbGetActiveTrackedOffers(): Promise<TrackedOffer[]> {
  await initDb()
  const res = await db.execute({
    sql: "SELECT * FROM tracked_offers WHERE status != 'morta'",
    args: [],
  })
  return res.rows.map(r => {
    const row = r as Record<string, unknown>
    return {
      id: row.id as string,
      user_id: row.user_id as number,
      pagina_nome: row.pagina_nome as string,
      page_id: (row.page_id as string) ?? null,
      ad_library_url: row.ad_library_url as string,
      landing_url: (row.landing_url as string) ?? null,
      nicho: (row.nicho as string) ?? null,
      primeiro_snapshot_ads: row.primeiro_snapshot_ads as number | null,
      ultimo_snapshot_ads: row.ultimo_snapshot_ads as number | null,
      primeiro_snapshot_data: (row.primeiro_snapshot_data as string) ?? null,
      ultimo_snapshot_data: (row.ultimo_snapshot_data as string) ?? null,
      landing_hash: (row.landing_hash as string) ?? null,
      status: row.status as string,
      alertas_nao_lidos: row.alertas_nao_lidos as number,
      criado_em: row.criado_em as string,
      verificado_em: (row.verificado_em as string) ?? null,
    }
  })
}

export async function dbUpdateTrackedOffer(offerId: string, updates: {
  ultimo_snapshot_ads?: number
  ultimo_snapshot_data?: string
  landing_hash?: string
  status?: string
  alertas_nao_lidos?: number
  page_id?: string
}): Promise<void> {
  await initDb()
  const sets: string[] = ["verificado_em = datetime('now')"]
  const args: (string | number | null)[] = []
  if (updates.ultimo_snapshot_ads !== undefined) { sets.push('ultimo_snapshot_ads = ?'); args.push(updates.ultimo_snapshot_ads) }
  if (updates.ultimo_snapshot_data !== undefined) { sets.push('ultimo_snapshot_data = ?'); args.push(updates.ultimo_snapshot_data) }
  if (updates.landing_hash !== undefined) { sets.push('landing_hash = ?'); args.push(updates.landing_hash) }
  if (updates.status !== undefined) { sets.push('status = ?'); args.push(updates.status) }
  if (updates.page_id !== undefined) { sets.push('page_id = ?'); args.push(updates.page_id) }
  if (updates.alertas_nao_lidos !== undefined) { sets.push('alertas_nao_lidos = ?'); args.push(updates.alertas_nao_lidos) }
  args.push(offerId)
  await db.execute({ sql: `UPDATE tracked_offers SET ${sets.join(', ')} WHERE id = ?`, args })
}

export async function dbCreateOfferAlert(data: {
  id: string
  tracked_offer_id: string
  tipo: string
  mensagem: string
  dados_anteriores?: string
  dados_novos?: string
}): Promise<void> {
  await initDb()
  await db.execute({
    sql: 'INSERT INTO offer_alerts (id, tracked_offer_id, tipo, mensagem, dados_anteriores, dados_novos) VALUES (?, ?, ?, ?, ?, ?)',
    args: [data.id, data.tracked_offer_id, data.tipo, data.mensagem, data.dados_anteriores ?? null, data.dados_novos ?? null],
  })
  await db.execute({
    sql: 'UPDATE tracked_offers SET alertas_nao_lidos = alertas_nao_lidos + 1 WHERE id = ?',
    args: [data.tracked_offer_id],
  })
}

export async function dbGetOfferAlerts(offerId: string): Promise<OfferAlert[]> {
  await initDb()
  const res = await db.execute({
    sql: 'SELECT * FROM offer_alerts WHERE tracked_offer_id = ? ORDER BY criado_em DESC LIMIT 50',
    args: [offerId],
  })
  return res.rows.map(r => {
    const row = r as Record<string, unknown>
    return {
      id: row.id as string,
      tracked_offer_id: row.tracked_offer_id as string,
      tipo: row.tipo as string,
      mensagem: row.mensagem as string,
      dados_anteriores: (row.dados_anteriores as string) ?? null,
      dados_novos: (row.dados_novos as string) ?? null,
      lido: row.lido as number,
      criado_em: row.criado_em as string,
    }
  })
}

export async function dbMarkAlertsRead(offerId: string): Promise<void> {
  await initDb()
  await db.execute({ sql: 'UPDATE offer_alerts SET lido = 1 WHERE tracked_offer_id = ? AND lido = 0', args: [offerId] })
  await db.execute({ sql: 'UPDATE tracked_offers SET alertas_nao_lidos = 0 WHERE id = ?', args: [offerId] })
}

// ── Offer snapshots ──────────────────────────────────────────────────────────

export type OfferSnapshot = {
  id: string
  tracked_offer_id: string
  ads_count: number
  variacao: number
  variacao_percent: number
  registrado_em: string
}

export async function dbCreateSnapshot(data: {
  id: string
  tracked_offer_id: string
  ads_count: number
  variacao?: number
  variacao_percent?: number
}): Promise<void> {
  await initDb()
  await db.execute({
    sql: 'INSERT INTO offer_snapshots (id, tracked_offer_id, ads_count, variacao, variacao_percent) VALUES (?, ?, ?, ?, ?)',
    args: [data.id, data.tracked_offer_id, data.ads_count, data.variacao ?? 0, data.variacao_percent ?? 0],
  })
}

export async function dbGetSnapshots(offerId: string): Promise<OfferSnapshot[]> {
  await initDb()
  const res = await db.execute({
    sql: 'SELECT * FROM offer_snapshots WHERE tracked_offer_id = ? ORDER BY registrado_em DESC LIMIT 90',
    args: [offerId],
  })
  return res.rows.map(r => {
    const row = r as Record<string, unknown>
    return {
      id: row.id as string,
      tracked_offer_id: row.tracked_offer_id as string,
      ads_count: row.ads_count as number,
      variacao: row.variacao as number,
      variacao_percent: row.variacao_percent as number,
      registrado_em: row.registrado_em as string,
    }
  })
}

export async function dbGetLastSnapshot(offerId: string): Promise<OfferSnapshot | null> {
  await initDb()
  const res = await db.execute({
    sql: 'SELECT * FROM offer_snapshots WHERE tracked_offer_id = ? ORDER BY registrado_em DESC LIMIT 1',
    args: [offerId],
  })
  if (!res.rows[0]) return null
  const row = res.rows[0] as Record<string, unknown>
  return {
    id: row.id as string,
    tracked_offer_id: row.tracked_offer_id as string,
    ads_count: row.ads_count as number,
    variacao: row.variacao as number,
    variacao_percent: row.variacao_percent as number,
    registrado_em: row.registrado_em as string,
  }
}

// ── Visitor tracking (real-time) ─────────────────────────────────────────────

export type VisitorSession = {
  id: number
  session_id: string
  user_id: number | null
  email: string | null
  page: string
  referrer: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  ip: string | null
  user_agent: string | null
  device: string | null
  started_at: string
  last_seen: string
}

export async function dbUpsertVisitor(data: {
  session_id: string
  user_id?: number | null
  email?: string | null
  page: string
  referrer?: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  ip?: string | null
  user_agent?: string | null
  device?: string | null
}): Promise<void> {
  await initDb()
  await db.execute({
    sql: `INSERT INTO visitor_sessions (session_id, user_id, email, page, referrer, utm_source, utm_medium, utm_campaign, ip, user_agent, device)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(session_id) DO UPDATE SET
            page = excluded.page,
            user_id = COALESCE(excluded.user_id, visitor_sessions.user_id),
            email = COALESCE(excluded.email, visitor_sessions.email),
            last_seen = datetime('now')`,
    args: [
      data.session_id,
      data.user_id ?? null,
      data.email ?? null,
      data.page,
      data.referrer ?? null,
      data.utm_source ?? null,
      data.utm_medium ?? null,
      data.utm_campaign ?? null,
      data.ip ?? null,
      data.user_agent ?? null,
      data.device ?? null,
    ],
  })
}

export async function dbLogPageView(sessionId: string, userId: number | null, page: string): Promise<void> {
  await initDb()
  await db.execute({
    sql: 'INSERT INTO page_views (session_id, user_id, page) VALUES (?, ?, ?)',
    args: [sessionId, userId, page],
  })
}

export async function dbGetActiveVisitors(minutesAgo = 2): Promise<VisitorSession[]> {
  await initDb()
  const res = await db.execute({
    sql: `SELECT * FROM visitor_sessions
          WHERE last_seen >= datetime('now', '-' || ? || ' minutes')
          ORDER BY last_seen DESC`,
    args: [minutesAgo],
  })
  return res.rows.map(r => {
    const row = r as Record<string, unknown>
    return {
      id: row.id as number,
      session_id: row.session_id as string,
      user_id: (row.user_id as number) ?? null,
      email: (row.email as string) ?? null,
      page: row.page as string,
      referrer: (row.referrer as string) ?? null,
      utm_source: (row.utm_source as string) ?? null,
      utm_medium: (row.utm_medium as string) ?? null,
      utm_campaign: (row.utm_campaign as string) ?? null,
      ip: (row.ip as string) ?? null,
      user_agent: (row.user_agent as string) ?? null,
      device: (row.device as string) ?? null,
      started_at: row.started_at as string,
      last_seen: row.last_seen as string,
    }
  })
}

export async function dbGetVisitorStats(): Promise<{
  online: number
  todayUnique: number
  todayPageViews: number
  byPage: { page: string; count: number }[]
}> {
  await initDb()
  const [onlineRes, uniqueRes, pvRes, byPageRes] = await Promise.all([
    db.execute({
      sql: `SELECT COUNT(*) as n FROM visitor_sessions WHERE last_seen >= datetime('now', '-2 minutes')`,
      args: [],
    }),
    db.execute({
      sql: `SELECT COUNT(DISTINCT session_id) as n FROM page_views WHERE created_at >= datetime('now', 'start of day')`,
      args: [],
    }),
    db.execute({
      sql: `SELECT COUNT(*) as n FROM page_views WHERE created_at >= datetime('now', 'start of day')`,
      args: [],
    }),
    db.execute({
      sql: `SELECT page, COUNT(*) as n FROM visitor_sessions WHERE last_seen >= datetime('now', '-2 minutes') GROUP BY page ORDER BY n DESC`,
      args: [],
    }),
  ])
  return {
    online: Number(onlineRes.rows[0].n),
    todayUnique: Number(uniqueRes.rows[0].n),
    todayPageViews: Number(pvRes.rows[0].n),
    byPage: byPageRes.rows.map(r => ({ page: r.page as string, count: Number(r.n) })),
  }
}

export async function dbCleanOldVisitors(): Promise<void> {
  await initDb()
  await db.execute({
    sql: `DELETE FROM visitor_sessions WHERE last_seen < datetime('now', '-1 hour')`,
    args: [],
  })
}

// ── Auto-mined offers ────────────────────────────────────────────────────────

export type AutoMinedOffer = {
  id: string
  page_name: string
  page_id: string
  ad_count: number
  landing_url: string | null
  thumbnail_url: string | null
  creative_urls: string | null
  nicho: string | null
  keyword_source: string | null
  dias_rodando: number | null
  first_seen: string
  last_seen: string
  status: string
  enriched: number
  ig_handle: string | null
  ig_followers: number | null
  fb_followers: number | null
  landing_screenshot: string | null
  ad_copies: string | null
}

export async function dbUpsertMinedOffer(data: {
  page_name: string
  page_id: string
  ad_count: number
  landing_url?: string | null
  thumbnail_url?: string | null
  creative_urls?: string | null
  nicho?: string | null
  keyword_source?: string | null
  dias_rodando?: number | null
}): Promise<void> {
  await initDb()
  const id = `mo_${data.page_id}`
  await db.execute({
    sql: `INSERT INTO auto_mined_offers (id, page_name, page_id, ad_count, landing_url, thumbnail_url, creative_urls, nicho, keyword_source, dias_rodando)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(page_id) DO UPDATE SET
            ad_count = excluded.ad_count,
            landing_url = COALESCE(excluded.landing_url, auto_mined_offers.landing_url),
            thumbnail_url = COALESCE(excluded.thumbnail_url, auto_mined_offers.thumbnail_url),
            creative_urls = COALESCE(excluded.creative_urls, auto_mined_offers.creative_urls),
            dias_rodando = COALESCE(excluded.dias_rodando, auto_mined_offers.dias_rodando),
            last_seen = datetime('now'),
            status = 'ativa'`,
    args: [id, data.page_name, data.page_id, data.ad_count, data.landing_url ?? null, data.thumbnail_url ?? null, data.creative_urls ?? null, data.nicho ?? null, data.keyword_source ?? null, data.dias_rodando ?? null],
  })
}

export async function dbGetMinedOffers(opts: {
  search?: string
  nicho?: string
  limit?: number
  offset?: number
  sortBy?: 'ad_count' | 'dias_rodando' | 'last_seen'
}): Promise<{ offers: AutoMinedOffer[]; total: number }> {
  await initDb()
  const where: string[] = [
    "status IN ('ouro', 'ativa')",
    "ad_count >= 5",
    "ad_count <= 140",
    "(fb_followers IS NULL OR fb_followers < 10000)",
    "(ig_followers IS NULL OR ig_followers < 10000)",
  ]
  const args: (string | number)[] = []

  if (opts.search) {
    where.push('page_name LIKE ?')
    args.push(`%${opts.search}%`)
  }
  if (opts.nicho) {
    where.push('nicho LIKE ?')
    args.push(`%${opts.nicho}%`)
  }

  const whereStr = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  const sort = opts.sortBy === 'dias_rodando' ? 'dias_rodando DESC' : opts.sortBy === 'last_seen' ? 'last_seen DESC' : 'ad_count DESC'
  const limit = opts.limit || 48
  const offset = opts.offset || 0

  const [countRes, dataRes] = await Promise.all([
    db.execute({ sql: `SELECT COUNT(*) as n FROM auto_mined_offers ${whereStr}`, args }),
    db.execute({ sql: `SELECT * FROM auto_mined_offers ${whereStr} ORDER BY ${sort} LIMIT ? OFFSET ?`, args: [...args, limit, offset] }),
  ])

  return {
    total: Number(countRes.rows[0]?.n ?? 0),
    offers: dataRes.rows.map(r => {
      const row = r as Record<string, unknown>
      return {
        id: row.id as string,
        page_name: row.page_name as string,
        page_id: row.page_id as string,
        ad_count: row.ad_count as number,
        landing_url: (row.landing_url as string) ?? null,
        thumbnail_url: (row.thumbnail_url as string) ?? null,
        creative_urls: (row.creative_urls as string) ?? null,
        nicho: (row.nicho as string) ?? null,
        keyword_source: (row.keyword_source as string) ?? null,
        dias_rodando: (row.dias_rodando as number) ?? null,
        first_seen: row.first_seen as string,
        last_seen: row.last_seen as string,
        status: row.status as string,
        enriched: (row.enriched as number) ?? 0,
        ig_handle: (row.ig_handle as string) ?? null,
        ig_followers: (row.ig_followers as number) ?? null,
        fb_followers: (row.fb_followers as number) ?? null,
        landing_screenshot: (row.landing_screenshot as string) ?? null,
        ad_copies: (row.ad_copies as string) ?? null,
      }
    }),
  }
}

export async function dbUpdateMinedOfferStatus(pageId: string, status: string, nicho?: string, extra?: {
  ig_handle?: string | null
  ig_followers?: number | null
  fb_followers?: number | null
}): Promise<void> {
  await initDb()
  // Auto-discard offers with 10k+ followers (not low ticket)
  if (extra?.ig_followers && extra.ig_followers >= 10000 || extra?.fb_followers && extra.fb_followers >= 10000) {
    status = 'descartada'
  }
  const sets = ['status = ?']
  const args: (string | number | null)[] = [status]
  if (nicho) { sets.push('nicho = ?'); args.push(nicho) }
  if (extra?.ig_handle !== undefined) { sets.push('ig_handle = ?'); args.push(extra.ig_handle) }
  if (extra?.ig_followers !== undefined) { sets.push('ig_followers = ?'); args.push(extra.ig_followers) }
  if (extra?.fb_followers !== undefined) { sets.push('fb_followers = ?'); args.push(extra.fb_followers) }
  if (extra) { sets.push('enriched = 1') }
  args.push(pageId)
  await db.execute({ sql: `UPDATE auto_mined_offers SET ${sets.join(', ')} WHERE page_id = ?`, args })
}

export async function dbGetUnclassifiedOffers(limit = 10): Promise<AutoMinedOffer[]> {
  await initDb()
  const res = await db.execute({
    sql: `SELECT * FROM auto_mined_offers WHERE status = 'ativa' ORDER BY ad_count DESC LIMIT ?`,
    args: [limit],
  })
  return res.rows.map(r => {
    const row = r as Record<string, unknown>
    return {
      id: row.id as string, page_name: row.page_name as string, page_id: row.page_id as string,
      ad_count: row.ad_count as number, landing_url: (row.landing_url as string) ?? null,
      thumbnail_url: (row.thumbnail_url as string) ?? null, creative_urls: (row.creative_urls as string) ?? null,
      nicho: (row.nicho as string) ?? null, keyword_source: (row.keyword_source as string) ?? null,
      dias_rodando: (row.dias_rodando as number) ?? null, first_seen: row.first_seen as string,
      last_seen: row.last_seen as string, status: row.status as string,
        enriched: (row.enriched as number) ?? 0,
        ig_handle: (row.ig_handle as string) ?? null,
        ig_followers: (row.ig_followers as number) ?? null,
        fb_followers: (row.fb_followers as number) ?? null,
        landing_screenshot: (row.landing_screenshot as string) ?? null,
        ad_copies: (row.ad_copies as string) ?? null,
    }
  })
}

export async function dbGetMinedOfferByPageId(pageId: string): Promise<AutoMinedOffer | null> {
  await initDb()
  const res = await db.execute({ sql: 'SELECT * FROM auto_mined_offers WHERE page_id = ?', args: [pageId] })
  if (!res.rows[0]) return null
  const row = res.rows[0] as Record<string, unknown>
  return {
    id: row.id as string,
    page_name: row.page_name as string,
    page_id: row.page_id as string,
    ad_count: row.ad_count as number,
    landing_url: (row.landing_url as string) ?? null,
    thumbnail_url: (row.thumbnail_url as string) ?? null,
    creative_urls: (row.creative_urls as string) ?? null,
    nicho: (row.nicho as string) ?? null,
    keyword_source: (row.keyword_source as string) ?? null,
    dias_rodando: (row.dias_rodando as number) ?? null,
    first_seen: row.first_seen as string,
    last_seen: row.last_seen as string,
    status: row.status as string,
        enriched: (row.enriched as number) ?? 0,
        ig_handle: (row.ig_handle as string) ?? null,
        ig_followers: (row.ig_followers as number) ?? null,
        fb_followers: (row.fb_followers as number) ?? null,
        landing_screenshot: (row.landing_screenshot as string) ?? null,
        ad_copies: (row.ad_copies as string) ?? null,
  }
}

// ── ManyChat click tracking ─────────────────────────────────────────────────
export async function dbSetMcSlug(userId: number, slug: string) {
  await initDb()
  await db.execute({ sql: 'UPDATE users SET mc_slug = ? WHERE id = ? AND mc_slug IS NULL', args: [slug, userId] })
}

export async function dbGetMcSales() {
  await initDb()
  const res = await db.execute({
    sql: `SELECT mc_slug, COUNT(*) as vendas,
          SUM(CASE WHEN plano != 'trial' THEN 1 ELSE 0 END) as vendas_pagas
          FROM users WHERE mc_slug IS NOT NULL GROUP BY mc_slug ORDER BY vendas DESC`,
    args: [],
  })
  return res.rows.map(r => ({
    slug: (r as Record<string, unknown>).mc_slug as string,
    vendas: (r as Record<string, unknown>).vendas as number,
    vendas_pagas: (r as Record<string, unknown>).vendas_pagas as number,
  }))
}

export async function dbLogMcClick(slug: string, ip?: string, userAgent?: string) {
  await initDb()
  await db.execute({
    sql: 'INSERT INTO mc_clicks (slug, ip, user_agent) VALUES (?, ?, ?)',
    args: [slug, ip ?? null, userAgent ?? null],
  })
}

export async function dbGetMcStats() {
  await initDb()
  const total = await db.execute({ sql: 'SELECT COUNT(*) as total FROM mc_clicks', args: [] })
  const bySlug = await db.execute({
    sql: `SELECT slug, COUNT(*) as clicks, MAX(created_at) as last_click
          FROM mc_clicks GROUP BY slug ORDER BY clicks DESC LIMIT 20`,
    args: [],
  })
  const today = await db.execute({
    sql: `SELECT COUNT(*) as total FROM mc_clicks WHERE created_at >= date('now')`,
    args: [],
  })
  return {
    total: (total.rows[0] as Record<string, unknown>).total as number,
    today: (today.rows[0] as Record<string, unknown>).total as number,
    bySlug: bySlug.rows.map(r => ({
      slug: (r as Record<string, unknown>).slug as string,
      clicks: (r as Record<string, unknown>).clicks as number,
      last_click: (r as Record<string, unknown>).last_click as string,
    })),
  }
}

export default db
