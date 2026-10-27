import { createPool } from 'mysql2/promise'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

let pool
let migrationPromise

function databaseOptions() {
  const raw = process.env.DATABASE_URL
  if (!raw) throw new Error('database_not_configured')
  const url = new URL(raw)
  if (url.protocol !== 'mysql:' && url.protocol !== 'mysql2:') throw new Error('database_url_invalid')
  const params = url.searchParams
  const sslOption = params.get('ssl-mode') || params.get('sslmode') || params.get('ssl')
  const tlsDisabled = sslOption && ['0', 'false', 'off', 'disable', 'disabled'].includes(sslOption.toLowerCase())
  const ssl = tlsDisabled ? undefined : { rejectUnauthorized: true }
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    ssl,
    timezone: 'Z',
    dateStrings: true,
    waitForConnections: true,
    connectionLimit: 8,
    queueLimit: 50,
    enableKeepAlive: true,
    connectTimeout: 10000,
  }
}

export function getPool() {
  if (!pool) pool = createPool(databaseOptions())
  return pool
}

export async function withConnection(fn) {
  const connection = await getPool().getConnection()
  try {
    await connection.query("SET time_zone = '+00:00'")
    return await fn(connection)
  } finally {
    connection.release()
  }
}

export async function inTransaction(fn, maxAttempts = 2) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await withConnection(async (connection) => {
        await connection.beginTransaction()
        try {
          const result = await fn(connection)
          await connection.commit()
          return result
        } catch (error) {
          await connection.rollback()
          throw error
        }
      })
    } catch (error) {
      if (attempt >= maxAttempts || !['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error?.code)) throw error
    }
  }
}

export async function runMigrations() {
  if (migrationPromise) return migrationPromise
  migrationPromise = (async () => {
    const directory = fileURLToPath(new URL('../db/migrations/', import.meta.url))
    const files = (await readdir(directory)).filter((name) => /^\d+_[a-z0-9_]+\.sql$/i.test(name)).sort()
    await withConnection(async (connection) => {
      await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(120) NOT NULL PRIMARY KEY,
        applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB`)
      for (const file of files) {
        const [rows] = await connection.execute('SELECT version FROM schema_migrations WHERE version = ?', [file])
        if (rows.length) continue
        const sql = await readFile(new URL(`../db/migrations/${file}`, import.meta.url), 'utf8')
        for (const statement of sql.split(';').map((part) => part.trim()).filter(Boolean)) await connection.query(statement)
        await connection.execute('INSERT INTO schema_migrations (version) VALUES (?)', [file])
      }
    })
    return true
  })().catch((error) => {
    migrationPromise = undefined
    throw error
  })
  return migrationPromise
}

export async function ensureDatabaseReady() {
  await runMigrations()
  return withConnection(async (connection) => {
    await connection.query('SELECT 1')
    return true
  })
}

export async function closePool() {
  if (!pool) return
  const current = pool
  pool = undefined
  migrationPromise = undefined
  await current.end()
}
