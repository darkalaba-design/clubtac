import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { canManageEvents } from '@/lib/admin/appRole'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'
import {
    ADMIN_CHAT_MESSAGES_INITIAL,
    ADMIN_CHAT_MESSAGES_OLDER_PAGE,
    parseAdminPlayerMessageRow,
    sortAdminPlayerMessagesAsc,
    type AdminPlayerMessagesResponse,
} from '@/lib/admin/adminPlayerMessages'

type RouteParams = { params: Promise<{ userId: string }> }

const MAX_LIMIT = 100

function parseUserId(raw: string): number | null {
    const id = Number.parseInt(raw, 10)
    if (!Number.isFinite(id) || id < 1) return null
    return id
}

function parseLimit(searchParams: URLSearchParams, fallback: number): number | null {
    const raw = searchParams.get('limit')
    if (raw == null || raw === '') return fallback
    const n = Number.parseInt(raw, 10)
    if (!Number.isFinite(n) || n < 1) return null
    return Math.min(n, MAX_LIMIT)
}

/** Значения в `.or()` PostgREST — в кавычках, если есть спецсимволы (ISO-дата и т.д.) */
function postgrestFilterValue(raw: string): string {
    if (/[,:()]/.test(raw) || /\s/.test(raw)) {
        return `"${raw.replace(/"/g, '""')}"`
    }
    return raw
}

function parseCursor(
    searchParams: URLSearchParams
): { before_created_at: string; before_id: string } | null | 'invalid' {
    const before_created_at = searchParams.get('before_created_at')
    const before_id = searchParams.get('before_id')
    if (!before_created_at && !before_id) return null
    if (!before_created_at || !before_id) return 'invalid'
    return { before_created_at, before_id }
}

/** История переписки бота с игроком (clubtac_messages), с пагинацией от новых к старым. */
export async function GET(request: NextRequest, ctx: RouteParams) {
    const gate = await requireActor(request)
    if (!gate.ok) return gate.response

    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return blocked

    if (!canManageEvents(gate.actor.app_role)) {
        return NextResponse.json({ error: 'Нужны права admin или root' }, { status: 403 })
    }

    const { userId: userIdRaw } = await ctx.params
    const userId = parseUserId(userIdRaw)
    if (userId == null) {
        return NextResponse.json({ error: 'Некорректный id игрока' }, { status: 400 })
    }

    const { searchParams } = request.nextUrl
    const cursor = parseCursor(searchParams)
    if (cursor === 'invalid') {
        return NextResponse.json(
            { error: 'Укажите before_created_at и before_id вместе' },
            { status: 400 }
        )
    }

    const defaultLimit = cursor ? ADMIN_CHAT_MESSAGES_OLDER_PAGE : ADMIN_CHAT_MESSAGES_INITIAL
    const limit = parseLimit(searchParams, defaultLimit)
    if (limit == null) {
        return NextResponse.json({ error: 'Некорректный limit' }, { status: 400 })
    }

    const { supabase } = gate

    const { data: userRow, error: userErr } = await supabase
        .from('clubtac_users')
        .select('id')
        .eq('id', userId)
        .maybeSingle()

    if (userErr) {
        console.error('GET messages user:', userErr)
        return NextResponse.json({ error: userErr.message }, { status: 500 })
    }
    if (!userRow) {
        return NextResponse.json({ error: 'Игрок не найден' }, { status: 404 })
    }

    const fetchLimit = limit + 1
    let query = supabase
        .from('clubtac_messages')
        .select('id, user_id, message, created_at, sender')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(fetchLimit)

    if (cursor) {
        const { before_created_at, before_id } = cursor
        const ts = postgrestFilterValue(before_created_at)
        const id = postgrestFilterValue(before_id)
        query = query.or(`created_at.lt.${ts},and(created_at.eq.${ts},id.lt.${id})`)
    }

    const { data: rows, error: msgErr } = await query

    if (msgErr) {
        console.error('GET messages:', msgErr)
        return NextResponse.json({ error: msgErr.message }, { status: 500 })
    }

    const rawRows = rows ?? []
    const has_more = rawRows.length > limit
    const pageRows = rawRows.slice(0, limit)

    const messages = sortAdminPlayerMessagesAsc(
        pageRows
            .map((row) => parseAdminPlayerMessageRow(row as Record<string, unknown>))
            .filter((m): m is NonNullable<typeof m> => m != null)
    )

    const body: AdminPlayerMessagesResponse = { messages, has_more }
    return NextResponse.json(body)
}
