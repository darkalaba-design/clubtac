import { getMakeEventRegistrationWebhookUrl } from '@/lib/makeWebhooks'

export type EventRegistrationWebhookPayload = {
    event_id: string
    user_id: number | null
    telegram_id: number | null
}

export type EventRegistrationWebhookResult =
    | { ok: true; data: unknown; rawText: string }
    | { ok: false; error: string; httpStatus?: number }

export async function sendEventRegistrationViaMake(
    payload: EventRegistrationWebhookPayload
): Promise<EventRegistrationWebhookResult> {
    const url = getMakeEventRegistrationWebhookUrl()
    if (!url) {
        return { ok: false, error: 'CLUBTAC_MAKE_EVENT_REGISTRATION_WEBHOOK_URL не задан' }
    }

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event_id: payload.event_id,
                user_id: payload.user_id,
                telegram_id: payload.telegram_id,
            }),
            signal: AbortSignal.timeout(30_000),
        })

        const rawText = (await res.text().catch(() => '')).trim()

        if (!res.ok) {
            return {
                ok: false,
                httpStatus: res.status,
                error: rawText || `Make.com вернул ошибку (${res.status})`,
            }
        }

        let data: unknown = { message: rawText || 'Запрос принят' }
        if (rawText) {
            try {
                data = JSON.parse(rawText)
            } catch {
                data = { message: rawText }
            }
        }

        return { ok: true, data, rawText }
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Не удалось вызвать Make.com'
        return { ok: false, error: msg }
    }
}
