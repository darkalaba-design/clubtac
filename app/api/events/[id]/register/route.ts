import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/api'
import { sendEventRegistrationViaMake } from '@/lib/sendEventRegistrationViaMake'

type RouteParams = { params: Promise<{ id: string }> }

/** Запись на событие через Make.com (прокси с сервера). */
export async function POST(request: NextRequest, ctx: RouteParams) {
    const { id: eventId } = await ctx.params
    if (!eventId?.trim()) {
        return NextResponse.json({ error: 'Некорректный id события' }, { status: 400 })
    }

    let body: { user_id?: unknown; telegram_id?: unknown; confirm_cross_club?: unknown }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Нужен JSON в теле запроса' }, { status: 400 })
    }

    const confirmCrossClub = body.confirm_cross_club === true

    const userIdRaw = body.user_id
    const telegramIdRaw = body.telegram_id
    const userId =
        userIdRaw != null && Number.isFinite(Number(userIdRaw)) ? Number(userIdRaw) : null
    const telegramId =
        telegramIdRaw != null && Number.isFinite(Number(telegramIdRaw))
            ? Number(telegramIdRaw)
            : null

    if (userId == null || userId < 1) {
        return NextResponse.json({ error: 'Нужен корректный user_id' }, { status: 400 })
    }

    const supabase = createClient()

    const { data: userRow, error: userErr } = await supabase
        .from('clubtac_users')
        .select('id, telegram_id, is_active, club_id')
        .eq('id', userId)
        .maybeSingle()

    if (userErr) {
        console.error('POST /api/events/[id]/register user:', userErr)
        return NextResponse.json({ error: userErr.message }, { status: 500 })
    }
    if (!userRow || userRow.is_active === false) {
        return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    const dbTelegramId = Number((userRow as { telegram_id?: unknown }).telegram_id)
    if (telegramId != null && Number.isFinite(dbTelegramId) && telegramId !== dbTelegramId) {
        return NextResponse.json({ error: 'telegram_id не совпадает с профилем' }, { status: 403 })
    }

    const { data: eventRow, error: eventErr } = await supabase
        .from('clubtac_events')
        .select('id, status, club_id')
        .eq('id', eventId)
        .maybeSingle()

    if (eventErr) {
        console.error('POST /api/events/[id]/register event:', eventErr)
        return NextResponse.json({ error: eventErr.message }, { status: 500 })
    }
    if (!eventRow) {
        return NextResponse.json({ error: 'Событие не найдено' }, { status: 404 })
    }

    const eventStatus = String((eventRow as { status?: string }).status ?? '')
    if (eventStatus === 'cancelled' || eventStatus === 'canceled') {
        return NextResponse.json({ error: 'Событие отменено' }, { status: 409 })
    }

    const userClubId = (userRow as { club_id?: string | null }).club_id ?? null
    const eventClubId = (eventRow as { club_id?: string | null }).club_id ?? null
    if (
        userClubId &&
        eventClubId &&
        userClubId !== eventClubId &&
        !confirmCrossClub
    ) {
        return NextResponse.json(
            {
                error: 'Требуется подтверждение записи в другой город',
                requires_confirmation: true,
                user_club: userClubId,
                event_club: eventClubId,
            },
            { status: 409 }
        )
    }

    const makeResult = await sendEventRegistrationViaMake({
        event_id: eventId,
        user_id: userId,
        telegram_id: Number.isFinite(dbTelegramId) ? dbTelegramId : telegramId,
    })

    if (!makeResult.ok) {
        const status = makeResult.httpStatus && makeResult.httpStatus >= 500 ? 502 : 503
        return NextResponse.json({ error: makeResult.error }, { status })
    }

    return NextResponse.json(makeResult.data ?? { message: 'Запрос принят' })
}
