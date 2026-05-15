import { NextResponse } from 'next/server'

/**
 * Этап запуска приложенческой админки (параллельно WeWeb/Make).
 *
 * Если переменная **не задана** или пустая — доступ как сейчас: любой `admin` / `root` из БД.
 * Если задана — только перечисленные `telegram_id` (через запятую, пробел или `;`) могут
 * пользоваться `/admin` и `/api/admin/*`, даже если в БД уже есть другие admin.
 *
 * Когда протестируете и будете готовы открыть всем админам — очистите переменную.
 */
export function isTelegramAllowedForAppAdminSurface(telegramId: number): boolean {
    const raw = process.env.CLUBTAC_APP_ADMIN_ALLOWLIST?.trim()
    if (!raw) return true

    const ids = raw
        .split(/[\s,;]+/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0)

    if (ids.length === 0) return true

    return ids.includes(telegramId)
}

export function appAdminAllowlistDeniedResponse(): NextResponse {
    return NextResponse.json(
        {
            error: 'Вход в приложенческую админку сейчас ограничён списком этапа запуска.',
            code: 'APP_ADMIN_ALLOWLIST',
        },
        { status: 403 }
    )
}

/** После requireActor: если не в allowlist — сразу 403 (для всех маршрутов /api/admin кроме session). */
export function denyIfOutsideAppAdminAllowlist(telegramId: number): NextResponse | null {
    if (!isTelegramAllowedForAppAdminSurface(telegramId)) {
        return appAdminAllowlistDeniedResponse()
    }
    return null
}
