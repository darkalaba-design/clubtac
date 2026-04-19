import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { validateWebAppInitData } from '@/lib/telegram/validateWebAppInitData'

/**
 * Обновление takoff: service role + проверка подписи Telegram.WebApp.initData.
 * Тело: { initData: string, id: number, takoff: boolean } — user в initData должен совпадать с clubtac_users.telegram_id для этой id.
 */
export async function POST(request: NextRequest) {
    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim()
        if (!botToken) {
            console.error('API /user/takoff: не задан TELEGRAM_BOT_TOKEN')
            return NextResponse.json({ error: 'Сервер не настроен для проверки Telegram' }, { status: 503 })
        }

        const body = await request.json()
        const initData = typeof body?.initData === 'string' ? body.initData : ''
        const id = Number(body?.id)
        const takoff = body?.takoff

        if (!initData.trim()) {
            return NextResponse.json({ error: 'Нужен initData из Telegram.WebApp.initData' }, { status: 400 })
        }
        if (!Number.isFinite(id) || id <= 0) {
            return NextResponse.json({ error: 'Нужен корректный id пользователя' }, { status: 400 })
        }
        if (typeof takoff !== 'boolean') {
            return NextResponse.json({ error: 'Поле takoff должно быть boolean' }, { status: 400 })
        }

        const checked = validateWebAppInitData(initData, botToken)
        if (!checked.ok) {
            console.error('API /user/takoff: initData не прошёл проверку:', checked.error)
            return NextResponse.json({ error: checked.error }, { status: 401 })
        }

        const telegramIdFromTelegram = checked.parsed.userId

        const supabase = createServiceRoleClient()

        const { data: row, error: fetchErr } = await supabase
            .from('clubtac_users')
            .select('id, telegram_id')
            .eq('id', id)
            .maybeSingle()

        if (fetchErr) {
            console.error('API /user/takoff:', fetchErr)
            return NextResponse.json({ error: fetchErr.message }, { status: 500 })
        }
        if (!row) {
            return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
        }
        const dbTg = Number((row as { telegram_id?: number }).telegram_id)
        if (dbTg !== telegramIdFromTelegram) {
            return NextResponse.json({ error: 'initData не соответствует этому профилю' }, { status: 403 })
        }

        const { data, error } = await supabase
            .from('clubtac_users')
            .update({ takoff })
            .eq('id', id)
            .eq('telegram_id', telegramIdFromTelegram)
            .select()
            .maybeSingle()

        if (error) {
            console.error('API /user/takoff:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        if (!data) {
            return NextResponse.json({ error: 'Не удалось обновить пользователя' }, { status: 404 })
        }

        return NextResponse.json({ user: data })
    } catch (e) {
        console.error('API /user/takoff:', e)
        return NextResponse.json(
            { error: 'Внутренняя ошибка', details: e instanceof Error ? e.message : 'Unknown' },
            { status: 500 }
        )
    }
}
