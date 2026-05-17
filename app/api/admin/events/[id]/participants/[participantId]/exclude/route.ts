import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { canManageEvents } from '@/lib/admin/appRole'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'
import { isUuid } from '@/lib/uuid'
import {
    type EventParticipantRow,
    participantRefundAmount,
    walletOrderIdFromParticipant,
} from '@/lib/admin/eventParticipantWallet'

type RouteParams = { params: Promise<{ id: string; participantId: string }> }

/** Исключение участника: refund на кошелёк (если price_paid ≠ 0), затем payment_status = canceled. */
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

    if (!isUuid(eventId)) {
        return NextResponse.json({ error: 'Некорректный id события (ожидается UUID)' }, { status: 400 })
    }

    const participantKey = String(participantIdRaw ?? '').trim()
    if (!participantKey) {
        return NextResponse.json({ error: 'Некорректный id участника' }, { status: 400 })
    }

    const { supabase } = gate

    const { data: row, error: fetchErr } = await supabase
        .from('clubtac_event_participants')
        .select('id, order_id, event_id, user_id, payment_status, price_paid')
        .eq('id', participantKey)
        .eq('event_id', eventId)
        .maybeSingle()

    if (fetchErr) {
        console.error('POST exclude fetch participant:', fetchErr)
        return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    if (!row) {
        return NextResponse.json({ error: 'Участник не найден' }, { status: 404 })
    }

    const participant = row as EventParticipantRow

    if (participant.payment_status === 'canceled' || participant.payment_status === 'cancelled') {
        return NextResponse.json({ error: 'Участник уже исключён' }, { status: 409 })
    }

    const refundAmount = participantRefundAmount(participant.price_paid)

    if (refundAmount > 0) {
        const walletOrderId = walletOrderIdFromParticipant(participant)
        if (!walletOrderId) {
            return NextResponse.json(
                {
                    error:
                        'Для возврата на кошелёк нужен UUID: id участника или order_id в clubtac_event_participants.',
                },
                { status: 400 }
            )
        }

        const { error: walletErr } = await supabase.from('clubtac_wallet_transactions').insert({
            user_id: participant.user_id,
            amount: refundAmount,
            type: 'refund',
            order_id: walletOrderId,
            event_id: participant.event_id,
        })

        if (walletErr) {
            console.error('POST exclude wallet insert:', walletErr)
            return NextResponse.json({ error: walletErr.message }, { status: 500 })
        }
    }

    const { error: updateErr } = await supabase
        .from('clubtac_event_participants')
        .update({ payment_status: 'canceled' })
        .eq('id', participantKey)
        .eq('event_id', eventId)
        .neq('payment_status', 'canceled')

    if (updateErr) {
        console.error('POST exclude update participant:', updateErr)
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, refund: refundAmount })
}
