import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const outDir = path.join(rootDir, 'data', 'database-export')

/** Таблицы первоначальной выгрузки для партнёров (новые таблицы сюда не добавляем). */
const TABLES = [
    'clubtac_users',
    'clubtac_clubs',
    'clubtac_events',
    'clubtac_event_participants',
    'clubtac_games',
    'clubtac_players',
    'clubtac_elo_leaderboard',
    'clubtac_elo_ratings',
    'clubtac_players_hall_of_fame_v3',
    'clubtac_wallet_transactions',
    'clubtac_messages',
    'games_summary',
]

/** Ключ строки для инкрементального merge (только новые записи). */
const ROW_KEY = {
    clubtac_users: 'id',
    clubtac_clubs: 'id',
    clubtac_events: 'id',
    clubtac_event_participants: 'id',
    clubtac_games: 'id',
    clubtac_players: 'id',
    clubtac_elo_leaderboard: 'user_id',
    clubtac_elo_ratings: 'user_id',
    clubtac_players_hall_of_fame_v3: 'user_id',
    clubtac_wallet_transactions: 'id',
    clubtac_messages: 'id',
    games_summary: 'game_id',
}

async function loadEnvFile(filePath) {
    try {
        const raw = await readFile(filePath, 'utf8')
        for (const line of raw.split(/\r?\n/)) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith('#')) continue
            const eq = trimmed.indexOf('=')
            if (eq <= 0) continue
            const key = trimmed.slice(0, eq).trim()
            let value = trimmed.slice(eq + 1).trim()
            if (
                (value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))
            ) {
                value = value.slice(1, -1)
            }
            if (process.env[key] == null) process.env[key] = value
        }
    } catch {
        /* optional */
    }
}

async function fetchAllRows(supabase, table) {
    const pageSize = 1000
    let from = 0
    const rows = []

    while (true) {
        const { data, error } = await supabase.from(table).select('*').range(from, from + pageSize - 1)
        if (error) throw new Error(`${table}: ${error.message}`)
        if (!data?.length) break
        rows.push(...data)
        if (data.length < pageSize) break
        from += pageSize
    }

    return rows
}

function rowKeyValue(table, row) {
    const key = ROW_KEY[table]
    if (!key) throw new Error(`Не задан ROW_KEY для ${table}`)
    const value = row[key]
    if (value == null) throw new Error(`${table}: нет поля ${key}`)
    return String(value)
}

async function readManifest() {
    try {
        const raw = await readFile(path.join(outDir, '_manifest.json'), 'utf8')
        return JSON.parse(raw)
    } catch {
        return null
    }
}

async function readExistingRows(table) {
    try {
        const raw = await readFile(path.join(outDir, `${table}.json`), 'utf8')
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) throw new Error('ожидался массив')
        return parsed
    } catch {
        return null
    }
}

async function main() {
    const incremental = process.argv.includes('--incremental')

    await loadEnvFile(path.join(rootDir, '.env.local'))
    await loadEnvFile(path.join(rootDir, '.env'))

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
        throw new Error('Нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env.local')
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    await mkdir(outDir, { recursive: true })

    const exportedAt = new Date().toISOString()
    const previousManifest = incremental ? await readManifest() : null
    const tables =
        incremental && previousManifest?.tables
            ? Object.keys(previousManifest.tables)
            : TABLES

    const manifest = {
        exported_at: exportedAt,
        supabase_url: supabaseUrl,
        mode: incremental ? 'incremental' : 'full',
        tables: {},
        errors: {},
    }

    if (incremental) {
        manifest.previous_exported_at = previousManifest?.exported_at ?? null
        manifest.added_rows = {}
    }

    for (const table of tables) {
        process.stdout.write(`${incremental ? 'Добавление' : 'Экспорт'} ${table}… `)
        try {
            const remoteRows = await fetchAllRows(supabase, table)

            if (incremental) {
                const existingRows = (await readExistingRows(table)) ?? []
                const seen = new Set(existingRows.map((row) => rowKeyValue(table, row)))
                const newRows = remoteRows.filter((row) => !seen.has(rowKeyValue(table, row)))
                const merged = [...existingRows, ...newRows]
                const filePath = path.join(outDir, `${table}.json`)
                await writeFile(filePath, JSON.stringify(merged, null, 2), 'utf8')
                manifest.tables[table] = {
                    rows: merged.length,
                    file: `${table}.json`,
                    added: newRows.length,
                }
                manifest.added_rows[table] = newRows.length
                process.stdout.write(`+${newRows.length} (всего ${merged.length})\n`)
            } else {
                const filePath = path.join(outDir, `${table}.json`)
                await writeFile(filePath, JSON.stringify(remoteRows, null, 2), 'utf8')
                manifest.tables[table] = { rows: remoteRows.length, file: `${table}.json` }
                process.stdout.write(`${remoteRows.length} строк\n`)
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e)
            manifest.errors[table] = message
            process.stdout.write(`ошибка: ${message}\n`)
        }
    }

    await writeFile(path.join(outDir, '_manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
    console.log(`\nГотово: ${outDir}`)
}

main().catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
})
