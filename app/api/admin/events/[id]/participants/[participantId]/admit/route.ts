import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { canManageEvents } from '@/lib/admin/appRole'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'

type RouteParams = { params: Promise<{ id: string; participantId: string }> }

type AdmitMethod = 'cash' | 'free'

type ParticipantRow = {
    id: number
    event_id: string
    user_id: number
    payment_status: string
    price_paid: number | null
}

/** Допуск участника с pending: оплата наличными или бесплатно + записи в кошелёк. */
export async function POST(request: NextRequest, ctx: RouteParams) {
    const gate = await requireActor(request)
    if (!gate.ok) return gate.response

    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return blocked

    if (!canManageEvents(gate.actor.app_role)) {
        return NextResponse.json({ error: 'Нужны права admin или root' }, { status: 403 })
    }

    const { id: eventId, participantId: participantIdRaw } = await ctx.params
    if (!eventId || typeof eventId !== 'string') {
        return NextResponse.json({ error: 'Некорректный id события' }, { status: 400 })
    }

    const participantId = Number.parseInt(String(participantIdRaw), 10)
    if (!Number.isFinite(participantId) || participantId <= 0) {
        return NextResponse.json({ error: 'Некорректный id участника' }, { status: 400 })
    }

    let body: { method?: unknown }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Нужен JSON в теле запроса' }, { status: 400 })
    }

    const method = body.method
    if (method !== 'cash' && method !== 'free') {
        return NextResponse.json({ error: 'method: "cash" или "free"' }, { status: 400 })
    }

    const { supabase } = gate

    const { data: row, error: fetchErr } = await supabase
        .from('clubtac_event_participants')
        .select('id, event_id, user_id, payment_status, price_paid')
        .eq('id', participantId)
        .eq('event_id', eventId)
        .maybeSingle()

    if (fetchErr) {
        console.error('POST admit fetch participant:', fetchErr)
        return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    if (!row) {
        return NextResponse.json({ error: 'Участник не найден' }, { status: 404 })
    }

    const participant = row as ParticipantRow

    if (participant.payment_status !== 'pending') {
        return NextResponse.json(
            { error: 'Допуск доступен только для статуса pending' },
            { status: 409 }
        )
    }

    const amount =
        method === 'free'
            ? 0
            : Number(participant.price_paid)

    if (method === 'cash' && !Number.isFinite(amount)) {
        return NextResponse.json({ error: 'Не задана сумма price_paid для оплаты наличными' }, { status: 400 })
    }

    const participantPatch =
        method === 'free'
            ? { payment_status: 'paid', price_paid: 0 }
            : { payment_status: 'paid' }

    const { error: updateErr } = await supabase
        .from('clubtac_event_participants')
        .update(participantPatch)
        .eq('id', participantId)
        .eq('event_id', eventId)
        .eq('payment_status', 'pending')

    if (updateErr) {
        console.error('POST admit update participant:', updateErr)
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    const walletRows = [
        {
            user_id: participant.user_id,
            amount,
            type: 'manual_adjustment',
            order_id: participantId,
            event_id: eventId,
        },
        {
            user_id: participant.user_id,
            amount: -amount,
            type: 'game_payment',
            order_id: participantId,
            event_id: eventId,
        },
    ]

    const { error: walletErr } = await supabase.from('clubtac_wallet_transactions').insert(walletRows)

    if (walletErr) {
        console.error('POST admit wallet insert:', walletErr)
        await supabase
            .from('clubtac_event_participants')
            .update({ payment_status: 'pending', ...(method === 'free' ? { price_paid: participant.price_paid } : {}) })
            .eq('id', participantId)
            .eq('event_id', eventId)
        return NextResponse.json({ error: walletErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, method, amount })
}
