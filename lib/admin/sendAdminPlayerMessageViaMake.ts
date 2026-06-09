import { getMakeAdminMessageWebhookUrl } from '@/lib/makeWebhooks'

/**
 * Отправка админ-сообщения игроку через сценарий Make.com (чат 1:1).
 * URL: CLUBTAC_MAKE_ADMIN_MESSAGE_WEBHOOK_URL.
 */
export type MakeAdminMessagePayload = {
    telegram_id: number
    message_id: string
}

export type MakeAdminMessageResult =
    | { ok: true }
    | { ok: false; error: string; httpStatus?: number }

export { getMakeAdminMessageWebhookUrl }

export async function sendAdminPlayerMessageViaMake(
    payload: MakeAdminMessagePayload
): Promise<MakeAdminMessageResult> {
    const url = getMakeAdminMessageWebhookUrl()
    if (!url) {
        return {
            ok: false,
            error: 'CLUBTAC_MAKE_ADMIN_MESSAGE_WEBHOOK_URL не задан',
        }
    }

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegram_id: payload.telegram_id,
                message_id: payload.message_id,
            }),
            signal: AbortSignal.timeout(60_000),
        })

        if (!res.ok) {
            const text = (await res.text().catch(() => '')).trim()
            return {
                ok: false,
                httpStatus: res.status,
                error: text || `Make.com вернул ошибку (${res.status})`,
            }
        }

        return { ok: true }
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Не удалось вызвать Make.com'
        return { ok: false, error: msg }
    }
}
