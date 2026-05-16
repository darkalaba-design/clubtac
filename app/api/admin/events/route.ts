import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { canManageEvents } from '@/lib/admin/appRole'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'

const EVENT_SELECT =
    'id, title, starts_at, club_id, price, address, status, type, duration_minutes, template_id, created_at, description, cover, players_limit'

const EVENT_TYPES = ['game', 'workshop', 'party'] as const
const EVENT_STATUSES = ['scheduled', 'finished', 'cancelled', 'canceled'] as const

function parseEventType(v: unknown): (typeof EVENT_TYPES)[number] | null {
    if (typeof v !== 'string') return null
    return (EVENT_TYPES as readonly string[]).includes(v) ? (v as (typeof EVENT_TYPES)[number]) : null
}

function parseEventStatus(v: unknown): (typeof EVENT_STATUSES)[number] | null {
    if (typeof v !== 'string') return null
    return (EVENT_STATUSES as readonly string[]).includes(v) ? (v as (typeof EVENT_STATUSES)[number]) : null
}

/** Список событий для редактирования (admin / root). */
export async function GET(request: NextRequest) {
    const gate = await requireActor(request)
    if (!gate.ok) return gate.response

    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return blocked

    if (!canManageEvents(gate.actor.app_role)) {
        return NextResponse.json({ error: 'Нужны права admin или root' }, { status: 403 })
    }

    const { supabase } = gate
    const { data, error } = await supabase.from('clubtac_events').select(EVENT_SELECT).order('starts_at', { ascending: false }).limit(300)

    if (error) {
        console.error('GET /api/admin/events:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ events: data ?? [] })
}

/** Создание события (admin / root). */
export async function POST(request: NextRequest) {
    const gate = await requireActor(request)
    if (!gate.ok) return gate.response

    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return blocked

    if (!canManageEvents(gate.actor.app_role)) {
        return NextResponse.json({ error: 'Нужны права admin или root' }, { status: 403 })
    }

    let body: Record<string, unknown>
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Нужен JSON в теле запроса' }, { status: 400 })
    }

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const starts_at = typeof body.starts_at === 'string' ? body.starts_at.trim() : ''
    const address = typeof body.address === 'string' ? body.address.trim() : ''
    const clubIdRaw = typeof body.club_id === 'string' ? body.club_id.trim() : ''
    const club_id = clubIdRaw || process.env.CLUBTAC_DEFAULT_EVENT_CLUB_ID?.trim() || ''
    if (!title || !starts_at || !address) {
        return NextResponse.json(
            { error: 'Обязательны поля: title, starts_at (ISO), address; club_id или переменная CLUBTAC_DEFAULT_EVENT_CLUB_ID' },
            { status: 400 }
        )
    }
    if (!club_id) {
        return NextResponse.json(
            {
                error: 'Не задан club_id: передайте в теле запроса или задайте CLUBTAC_DEFAULT_EVENT_CLUB_ID на сервере',
            },
            { status: 400 }
        )
    }

    const type = parseEventType(body.type) ?? 'game'
    const status = parseEventStatus(body.status) ?? 'scheduled'

    const row: Record<string, unknown> = {
        id: typeof body.id === 'string' && body.id.trim() ? body.id.trim() : randomUUID(),
        title,
        starts_at,
        club_id,
        address,
        type,
        status,
    }

    if (body.price === null || body.price === undefined) {
        row.price = null
    } else if (typeof body.price === 'number' && Number.isFinite(body.price)) {
        row.price = body.price
    } else {
        return NextResponse.json({ error: 'price должен быть числом или null' }, { status: 400 })
    }

    if (body.duration_minutes === null || body.duration_minutes === undefined) {
        row.duration_minutes = null
    } else if (typeof body.duration_minutes === 'number' && Number.isFinite(body.duration_minutes)) {
        row.duration_minutes = Math.floor(body.duration_minutes)
    } else {
        return NextResponse.json({ error: 'duration_minutes должен быть целым числом или null' }, { status: 400 })
    }

    if (body.template_id === null || body.template_id === undefined) {
        row.template_id = null
    } else if (typeof body.template_id === 'string') {
        row.template_id = body.template_id.trim() || null
    } else {
        return NextResponse.json({ error: 'template_id должен быть строкой или null' }, { status: 400 })
    }

    if (body.description === null || body.description === undefined) {
        row.description = null
    } else if (typeof body.description === 'string') {
        row.description = body.description
    } else {
        return NextResponse.json({ error: 'description должна быть строкой или null' }, { status: 400 })
    }

    if (body.cover === null || body.cover === undefined) {
        row.cover = null
    } else if (typeof body.cover === 'string') {
        row.cover = body.cover.trim() || null
    } else {
        return NextResponse.json({ error: 'cover должен быть строкой (URL) или null' }, { status: 400 })
    }

    if (body.players_limit === null || body.players_limit === undefined) {
        row.players_limit = null
    } else if (typeof body.players_limit === 'number' && Number.isFinite(body.players_limit) && body.players_limit >= 0) {
        row.players_limit = Math.floor(body.players_limit)
    } else {
        return NextResponse.json({ error: 'players_limit: неотрицательное целое или null' }, { status: 400 })
    }

    const { supabase } = gate
    const { data, error } = await supabase.from('clubtac_events').insert(row).select(EVENT_SELECT).single()

    if (error) {
        console.error('POST /api/admin/events:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ event: data }, { status: 201 })
}
