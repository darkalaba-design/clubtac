import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { canManageEvents } from '@/lib/admin/appRole'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'
import { isUuid } from '@/lib/uuid'
import { type EventParticipantRow, walletOrderIdFromParticipant } from '@/lib/admin/eventParticipantWallet'

type RouteParams = { params: Promise<{ id: string }> }

type AddMethod = 'cash' | 'free'

function isCanceledStatus(status: string): boolean {
    return status === 'canceled' || status === 'cancelled'
}

/** Добавление участника админом (инициатива организатора): бесплатно или оплата наличными. */
export async function POST(request: NextRequest, ctx: RouteParams) {
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

    if (!isUuid(eventId)) {
        return NextResponse.json({ error: 'Некорректный id события (ожидается UUID)' }, { status: 400 })
    }

    let body: { user_id?: unknown; method?: unknown }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Нужен JSON в теле запроса' }, { status: 400 })
    }

    const userId = typeof body.user_id === 'number' ? body.user_id : Number(body.user_id)
    if (!Number.isFinite(userId) || userId < 1) {
        return NextResponse.json({ error: 'Некорректный user_id' }, { status: 400 })
    }

    const method = body.method
    if (method !== 'cash' && method !== 'free') {
        return NextResponse.json({ error: 'method: "cash" или "free"' }, { status: 400 })
    }

    const { supabase } = gate

    const { data: event, error: evErr } = await supabase
        .from('clubtac_events')
        .select('id, price')
        .eq('id', eventId)
        .maybeSingle()

    if (evErr) {
        console.error('POST participants fetch event:', evErr)
        return NextResponse.json({ error: evErr.message }, { status: 500 })
    }
    if (!event) {
        return NextResponse.json({ error: 'Событие не найдено' }, { status: 404 })
    }

    const { data: userRow, error: userErr } = await supabase
        .from('clubtac_users')
        .select('id')
        .eq('id', userId)
        .eq('is_active', true)
        .maybeSingle()

    if (userErr) {
        console.error('POST participants fetch user:', userErr)
        return NextResponse.json({ error: userErr.message }, { status: 500 })
    }
    if (!userRow) {
        return NextResponse.json({ error: 'Пользователь не найден или неактивен' }, { status: 404 })
    }

    const { data: existing, error: existErr } = await supabase
        .from('clubtac_event_participants')
        .select('id, order_id, event_id, user_id, payment_status, price_paid')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .maybeSingle()

    if (existErr) {
        console.error('POST participants fetch existing:', existErr)
        return NextResponse.json({ error: existErr.message }, { status: 500 })
    }

    if (existing && !isCanceledStatus(existing.payment_status)) {
        return NextResponse.json({ error: 'Игрок уже в списке участников этого события' }, { status: 409 })
    }

    const eventPriceRaw = event.price
    const eventPrice =
        eventPriceRaw != null && Number.isFinite(Number(eventPriceRaw)) ? Number(eventPriceRaw) : 0
    const pricePaid: number = method === 'free' ? 0 : eventPrice

    const participantPatch = {
        payment_status: 'paid' as const,
        price_paid: pricePaid,
    }

    let participant: EventParticipantRow

    if (existing) {
        const { data: updated, error: updateErr } = await supabase
            .from('clubtac_event_participants')
            .update(participantPatch)
            .eq('id', existing.id)
            .eq('event_id', eventId)
            .select('id, order_id, event_id, user_id, payment_status, price_paid')
            .single()

        if (updateErr) {
            console.error('POST participants update:', updateErr)
            return NextResponse.json({ error: updateErr.message }, { status: 500 })
        }
        participant = updated as EventParticipantRow
    } else {
        const orderId = randomUUID()
        const { data: inserted, error: insertErr } = await supabase
            .from('clubtac_event_participants')
            .insert({
                event_id: eventId,
                user_id: userId,
                order_id: orderId,
                ...participantPatch,
            })
            .select('id, order_id, event_id, user_id, payment_status, price_paid')
            .single()

        if (insertErr) {
            console.error('POST participants insert:', insertErr)
            return NextResponse.json({ error: insertErr.message }, { status: 500 })
        }
        participant = inserted as EventParticipantRow
    }

    if (method === 'free' || pricePaid <= 0) {
        return NextResponse.json({
            ok: true,
            method,
            amount: pricePaid,
            participant_id: participant.id,
        })
    }

    let walletOrderId = walletOrderIdFromParticipant(participant)
    if (!walletOrderId) {
        walletOrderId = randomUUID()
        const { error: orderPatchErr } = await supabase
            .from('clubtac_event_participants')
            .update({ order_id: walletOrderId })
            .eq('id', participant.id)
            .eq('event_id', eventId)

        if (orderPatchErr) {
            console.error('POST participants order_id patch:', orderPatchErr)
            return NextResponse.json({ error: orderPatchErr.message }, { status: 500 })
        }
    }

    const walletRows = [
        {
            user_id: participant.user_id,
            amount: pricePaid,
            type: 'manual_adjustment',
            order_id: walletOrderId,
            event_id: eventId,
        },
        {
            user_id: participant.user_id,
            amount: -pricePaid,
            type: 'game_payment',
            order_id: walletOrderId,
            event_id: eventId,
        },
    ]

    const { error: walletErr } = await supabase.from('clubtac_wallet_transactions').insert(walletRows)

    if (walletErr) {
        console.error('POST participants wallet insert:', walletErr)
        if (existing) {
            await supabase
                .from('clubtac_event_participants')
                .update({
                    payment_status: existing.payment_status,
                    price_paid: existing.price_paid,
                })
                .eq('id', existing.id)
                .eq('event_id', eventId)
        } else {
            await supabase
                .from('clubtac_event_participants')
                .delete()
                .eq('id', participant.id)
                .eq('event_id', eventId)
        }
        return NextResponse.json({ error: walletErr.message }, { status: 500 })
    }

    return NextResponse.json({
        ok: true,
        method,
        amount: pricePaid,
        order_id: walletOrderId,
        participant_id: participant.id,
    })
}
