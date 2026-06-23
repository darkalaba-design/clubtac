import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { canManageEvents } from '@/lib/admin/appRole'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'
import {
    requireEventInManagedClub,
    resolveEventClubIdForCreate,
} from '@/lib/admin/clubScope'

const EVENT_SELECT =
    'id, title, starts_at, club_id, price, address, status, type, duration_minutes, template_id, created_at, description, cover, players_limit'

const EVENT_TYPES = ['game', 'workshop', 'party'] as const
const EVENT_STATUSES = ['scheduled', 'finished', 'cancelled', 'hidden'] as const

function parseEventType(v: unknown): (typeof EVENT_TYPES)[number] | undefined {
    if (typeof v !== 'string') return undefined
    return (EVENT_TYPES as readonly string[]).includes(v) ? (v as (typeof EVENT_TYPES)[number]) : undefined
}

function parseEventStatus(v: unknown): (typeof EVENT_STATUSES)[number] | undefined {
    if (typeof v !== 'string') return undefined
    return (EVENT_STATUSES as readonly string[]).includes(v) ? (v as (typeof EVENT_STATUSES)[number]) : undefined
}

type RouteParams = { params: Promise<{ id: string }> }

/** Событие + участники (все строки clubtac_event_participants для события). */
export async function GET(request: NextRequest, ctx: RouteParams) {
    const gate = await requireActor(request)
    if (!gate.ok) return gate.response

    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return blocked

    if (!canManageEvents(gate.actor.app_role)) {
        return NextResponse.json({ error: 'Нужны права admin или root' }, { status: 403 })
    }

    const { id: eventId } = await ctx.params
    if (!eventId || typeof eventId !== 'string') {
        return NextResponse.json({ error: 'Некорректный id события' }, { status: 400 })
    }

    const { supabase } = gate

    const eventAccess = await requireEventInManagedClub(gate.actor, supabase, eventId)
    if (!eventAccess.ok) return eventAccess.response

    const { data: event, error: evErr } = await supabase
        .from('clubtac_events')
        .select(EVENT_SELECT)
        .eq('id', eventId)
        .maybeSingle()

    if (evErr) {
        console.error('GET /api/admin/events/[id]:', evErr)
        return NextResponse.json({ error: evErr.message }, { status: 500 })
    }
    if (!event) {
        return NextResponse.json({ error: 'Событие не найдено' }, { status: 404 })
    }

    const { data: partRows, error: pErr } = await supabase
        .from('clubtac_event_participants')
        .select('id, order_id, event_id, user_id, payment_status, price_paid, paylink, created_at')
        .eq('event_id', eventId)
        .neq('payment_status', 'canceled')
        .order('created_at', { ascending: false })

    if (pErr) {
        console.error('GET /api/admin/events/[id] participants:', pErr)
        return NextResponse.json({ error: pErr.message }, { status: 500 })
    }

    const rows = partRows ?? []
    const userIds = [...new Set(rows.map((r: { user_id: number }) => r.user_id).filter((id: number) => Number.isFinite(id) && id > 0))]

    let userMap: Record<
        number,
        {
            id: number
            first_name?: string | null
            last_name?: string | null
            username?: string | null
            nickname?: string | null
            userpic?: string | null
            takoff?: boolean | null
        }
    > = {}
    if (userIds.length > 0) {
        const { data: users, error: uErr } = await supabase
            .from('clubtac_users')
            .select('id, first_name, last_name, username, nickname, userpic, takoff')
            .in('id', userIds)

        if (uErr) {
            console.error('GET /api/admin/events/[id] users:', uErr)
            return NextResponse.json({ error: uErr.message }, { status: 500 })
        }
        users?.forEach((u: { id: number }) => {
            userMap[u.id] = u as (typeof userMap)[number]
        })
    }

    const participants = rows.map(
        (row: {
            id: string | number
            order_id?: string | null
            event_id: string
            user_id: number
            payment_status: string
            price_paid?: number | null
            paylink?: string | null
            created_at?: string | null
        }) => {
        const u = userMap[row.user_id]
        return {
            id: row.id,
            order_id: row.order_id ?? null,
            event_id: row.event_id,
            user_id: row.user_id,
            payment_status: row.payment_status,
            price_paid: row.price_paid ?? null,
            paylink: row.paylink ?? null,
            created_at: row.created_at ?? null,
            first_name: u?.first_name ?? null,
            last_name: u?.last_name ?? null,
            username: u?.username ?? null,
            nickname: u?.nickname ?? null,
            userpic: u?.userpic ?? null,
            takoff: !!u?.takoff,
        }
    })

    return NextResponse.json({ event, participants })
}

/** Частичное обновление события (admin / root). */
export async function PATCH(request: NextRequest, ctx: RouteParams) {
    const gate = await requireActor(request)
    if (!gate.ok) return gate.response

    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return blocked

    if (!canManageEvents(gate.actor.app_role)) {
        return NextResponse.json({ error: 'Нужны права admin или root' }, { status: 403 })
    }

    const { id: eventId } = await ctx.params
    if (!eventId || typeof eventId !== 'string') {
        return NextResponse.json({ error: 'Некорректный id события' }, { status: 400 })
    }

    let body: Record<string, unknown>
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Нужен JSON в теле запроса' }, { status: 400 })
    }

    const patch: Record<string, unknown> = {}

    if (body.title !== undefined) {
        if (typeof body.title !== 'string' || !body.title.trim()) {
            return NextResponse.json({ error: 'title должна быть непустой строкой' }, { status: 400 })
        }
        patch.title = body.title.trim()
    }
    if (body.starts_at !== undefined) {
        if (typeof body.starts_at !== 'string' || !body.starts_at.trim()) {
            return NextResponse.json({ error: 'starts_at должна быть непустой строкой (ISO)' }, { status: 400 })
        }
        patch.starts_at = body.starts_at.trim()
    }
    if (body.club_id !== undefined) {
        if (typeof body.club_id !== 'string' || !body.club_id.trim()) {
            return NextResponse.json({ error: 'club_id должна быть непустой строкой' }, { status: 400 })
        }
        patch.club_id = body.club_id.trim()
    }
    if (body.address !== undefined) {
        if (typeof body.address !== 'string' || !body.address.trim()) {
            return NextResponse.json({ error: 'address должна быть непустой строкой' }, { status: 400 })
        }
        patch.address = body.address.trim()
    }
    if (body.type !== undefined) {
        const t = parseEventType(body.type)
        if (!t) return NextResponse.json({ error: 'некорректный type' }, { status: 400 })
        patch.type = t
    }
    if (body.status !== undefined) {
        const s = parseEventStatus(body.status)
        if (!s) return NextResponse.json({ error: 'некорректный status' }, { status: 400 })
        patch.status = s
    }
    if (body.price !== undefined) {
        if (body.price === null) patch.price = null
        else if (typeof body.price === 'number' && Number.isFinite(body.price)) patch.price = body.price
        else return NextResponse.json({ error: 'price: число или null' }, { status: 400 })
    }
    if (body.duration_minutes !== undefined) {
        if (body.duration_minutes === null) patch.duration_minutes = null
        else if (typeof body.duration_minutes === 'number' && Number.isFinite(body.duration_minutes)) {
            patch.duration_minutes = Math.floor(body.duration_minutes)
        } else return NextResponse.json({ error: 'duration_minutes: целое или null' }, { status: 400 })
    }
    if (body.template_id !== undefined) {
        if (body.template_id === null) patch.template_id = null
        else if (typeof body.template_id === 'string') patch.template_id = body.template_id.trim() || null
        else return NextResponse.json({ error: 'template_id: строка или null' }, { status: 400 })
    }
    if (body.description !== undefined) {
        if (body.description === null) patch.description = null
        else if (typeof body.description === 'string') patch.description = body.description
        else return NextResponse.json({ error: 'description: строка или null' }, { status: 400 })
    }
    if (body.cover !== undefined) {
        if (body.cover === null) patch.cover = null
        else if (typeof body.cover === 'string') patch.cover = body.cover.trim() || null
        else return NextResponse.json({ error: 'cover: строка или null' }, { status: 400 })
    }
    if (body.players_limit !== undefined) {
        if (body.players_limit === null) patch.players_limit = null
        else if (typeof body.players_limit === 'number' && Number.isFinite(body.players_limit) && body.players_limit >= 0) {
            patch.players_limit = Math.floor(body.players_limit)
        } else return NextResponse.json({ error: 'players_limit: неотрицательное целое или null' }, { status: 400 })
    }

    if (Object.keys(patch).length === 0) {
        return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 })
    }

    const { supabase } = gate

    const eventAccess = await requireEventInManagedClub(gate.actor, supabase, eventId)
    if (!eventAccess.ok) return eventAccess.response

    if (patch.club_id !== undefined) {
        const clubResolved = resolveEventClubIdForCreate(gate.actor, String(patch.club_id))
        if (clubResolved instanceof NextResponse) return clubResolved
        patch.club_id = clubResolved
    }

    const { data, error } = await supabase.from('clubtac_events').update(patch).eq('id', eventId).select(EVENT_SELECT).maybeSingle()

    if (error) {
        console.error('PATCH /api/admin/events/[id]:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
        return NextResponse.json({ error: 'Событие не найдено' }, { status: 404 })
    }

    return NextResponse.json({ event: data })
}
