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

  initialized = true
}

// Plan definitions — single source of truth
export const PLANS: Record<string, { analises: number; mineracoes: number; slots_radar: number; label: string; periodo: string; dias: number }> = {
  trial: { analises: 1, mineracoes: 1, slots_radar: 1, label: 'Trial', periodo: 'teste', dias: 30 },
  starter: { analises: 10, mineracoes: 10, slots_radar: 5, label: 'Starter', periodo: 'mensal', dias: 30 },
  premium: { analises: 60, mineracoes: 60, slots_radar: 10, label: 'Premium', periodo: 'trimestral', dias: 90 },
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
            creditos = 100, kirvano_id = ?, name = ?, renova_em = ? WHERE email = ?`,
      args: [plano, plan.analises, plan.mineracoes, plan.analises, plan.mineracoes, plan.slots_radar, kirvano_id, name, renovaEm, email],
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

export default db
