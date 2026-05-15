import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { canManageEvents } from '@/lib/admin/appRole'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'

const EVENT_SELECT =
    'id, title, starts_at, club_id, price, address, status, type, duration_minutes, template_id, created_at, description, cover'

const EVENT_TYPES = ['game', 'workshop', 'party'] as const
const EVENT_STATUSES = ['scheduled', 'finished', 'cancelled', 'canceled'] as const

function parseEventType(v: unknown): (typeof EVENT_TYPES)[number] | undefined {
    if (typeof v !== 'string') return undefined
    return (EVENT_TYPES as readonly string[]).includes(v) ? (v as (typeof EVENT_TYPES)[number]) : undefined
}

function parseEventStatus(v: unknown): (typeof EVENT_STATUSES)[number] | undefined {
    if (typeof v !== 'string') return undefined
    return (EVENT_STATUSES as readonly string[]).includes(v) ? (v as (typeof EVENT_STATUSES)[number]) : undefined
}

type RouteParams = { params: Promise<{ id: string }> }

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

    if (Object.keys(patch).length === 0) {
        return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 })
    }

    const { supabase } = gate
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
