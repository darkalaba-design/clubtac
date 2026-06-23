import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { validateWebAppInitData } from '@/lib/telegram/validateWebAppInitData'

/**
 * Смена домашнего клуба игрока.
 * Тело: { initData: string, club_id: string }
 */
export async function PATCH(request: NextRequest) {
    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim()
        if (!botToken) {
            return NextResponse.json({ error: 'Сервер не настроен для проверки Telegram' }, { status: 503 })
        }

        const body = await request.json()
        const initData = typeof body?.initData === 'string' ? body.initData : ''
        const clubId = typeof body?.club_id === 'string' ? body.club_id.trim() : ''

        if (!initData.trim()) {
            return NextResponse.json({ error: 'Нужен initData из Telegram.WebApp.initData' }, { status: 400 })
        }
        if (!clubId) {
            return NextResponse.json({ error: 'Нужен club_id' }, { status: 400 })
        }

        const checked = validateWebAppInitData(initData, botToken)
        if (!checked.ok) {
            return NextResponse.json({ error: checked.error }, { status: 401 })
        }

        const supabase = createServiceRoleClient()

        const { data: club, error: clubErr } = await supabase
            .from('clubtac_clubs_public')
            .select('id')
            .eq('id', clubId)
            .maybeSingle()

        if (clubErr) {
            return NextResponse.json({ error: clubErr.message }, { status: 500 })
        }
        if (!club) {
            return NextResponse.json(
                { error: 'Можно выбрать только клуб одного из городов: Сочи, Серпухов, Москва' },
                { status: 400 }
            )
        }

        const { data, error } = await supabase
            .from('clubtac_users')
            .update({ club_id: clubId })
            .eq('telegram_id', checked.parsed.userId)
            .select()
            .maybeSingle()

        if (error) {
            console.error('PATCH /api/user/club:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }
        if (!data) {
            return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
        }

        return NextResponse.json({ user: data })
    } catch (e) {
        console.error('PATCH /api/user/club:', e)
        return NextResponse.json(
            { error: 'Внутренняя ошибка', details: e instanceof Error ? e.message : 'Unknown' },
            { status: 500 }
        )
    }
}
