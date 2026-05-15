import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { validateWebAppInitData } from '@/lib/telegram/validateWebAppInitData'
import type { AppRole } from '@/lib/admin/appRole'
import { parseAppRole } from '@/lib/admin/appRole'
import { TELEGRAM_INIT_DATA_HEADER } from '@/lib/admin/constants'

export type AdminActorRow = {
    id: number
    telegram_id: number
    first_name: string | null
    username: string | null
    app_role: AppRole
}

/**
 * Проверка Telegram Mini App initData + загрузка пользователя из clubtac_users.
 * Все админ-операции должны вызывать это до работы с service role.
 */
export async function requireActor(
    request: NextRequest
): Promise<{ ok: true; actor: AdminActorRow; supabase: ReturnType<typeof createServiceRoleClient> } | { ok: false; response: NextResponse }> {
    const initData = request.headers.get(TELEGRAM_INIT_DATA_HEADER)?.trim() || ''
    if (!initData) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: 'Нужен заголовок X-Telegram-Init-Data (Telegram.WebApp.initData)' },
                { status: 401 }
            ),
        }
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim()
    if (!botToken) {
        return {
            ok: false,
            response: NextResponse.json({ error: 'Сервер не настроен (TELEGRAM_BOT_TOKEN)' }, { status: 503 }),
        }
    }

    const checked = validateWebAppInitData(initData, botToken)
    if (!checked.ok) {
        return { ok: false, response: NextResponse.json({ error: checked.error }, { status: 401 }) }
    }

    const supabase = createServiceRoleClient()
    const { data: row, error } = await supabase
        .from('clubtac_users')
        .select('id, telegram_id, first_name, username, app_role')
        .eq('telegram_id', checked.parsed.userId)
        .maybeSingle()

    if (error) {
        console.error('requireActor: supabase', error)
        return { ok: false, response: NextResponse.json({ error: error.message }, { status: 500 }) }
    }
    if (!row) {
        return { ok: false, response: NextResponse.json({ error: 'Пользователь не найден в clubtac_users' }, { status: 404 }) }
    }

    const role = parseAppRole((row as { app_role?: unknown }).app_role)
    if (!role) {
        return { ok: false, response: NextResponse.json({ error: 'Некорректный app_role в базе' }, { status: 500 }) }
    }

    const actor: AdminActorRow = {
        id: (row as { id: number }).id,
        telegram_id: (row as { telegram_id: number }).telegram_id,
        first_name: (row as { first_name?: string | null }).first_name ?? null,
        username: (row as { username?: string | null }).username ?? null,
        app_role: role,
    }

    return { ok: true, actor, supabase }
}
