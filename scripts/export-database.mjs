import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const outDir = path.join(rootDir, 'data', 'database-export')

const TABLES = [
    'clubtac_users',
    'clubtac_clubs',
    'clubtac_cities',
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

async function main() {
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
    const manifest = {
        exported_at: exportedAt,
        supabase_url: supabaseUrl,
        tables: {},
        errors: {},
    }

    for (const table of TABLES) {
        process.stdout.write(`Экспорт ${table}… `)
        try {
            const rows = await fetchAllRows(supabase, table)
            const filePath = path.join(outDir, `${table}.json`)
            await writeFile(filePath, JSON.stringify(rows, null, 2), 'utf8')
            manifest.tables[table] = { rows: rows.length, file: `${table}.json` }
            process.stdout.write(`${rows.length} строк\n`)
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
