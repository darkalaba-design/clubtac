import { getMakeEventCoverWebhookUrl } from '@/lib/makeWebhooks'

/**
 * Вебхук Make.com для генерации обложки события.
 * URL: CLUBTAC_MAKE_EVENT_COVER_WEBHOOK_URL (или устаревший CLUBTAC_MAKE_EVENT_WEBHOOK_URL).
 */
export type EventImageWebhookPayload = {
    id: string
    title: string
    description: string | null
    type: string
    /** Пресет для генератора (board — игровая доска и т.п.) */
    imageVersion?: string
}

export type EventImageWebhookResult = { ok: true } | { ok: false; error: string }

export async function notifyMakeEventImageWebhook(
    event: EventImageWebhookPayload
): Promise<EventImageWebhookResult> {
    const url = getMakeEventCoverWebhookUrl()
    if (!url) {
        const error = 'Не задан CLUBTAC_MAKE_EVENT_COVER_WEBHOOK_URL'
        console.error(`notifyMakeEventImageWebhook: ${error}`)
        return { ok: false, error }
    }

    const body = {
        event_id: event.id,
        event_desc: event.description ?? '',
        event_name: event.title,
        event_type: event.type,
        image_version: event.imageVersion ?? 'board',
    }

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(20_000),
        })
        if (!res.ok) {
            const text = await res.text().catch(() => '')
            const error = text.trim() || `Make webhook HTTP ${res.status}`
            console.error('notifyMakeEventImageWebhook:', error)
            return { ok: false, error }
        }
        return { ok: true }
    } catch (err: unknown) {
        const error = err instanceof Error ? err.message : 'Ошибка вызова Make webhook'
        console.error('notifyMakeEventImageWebhook:', err)
        return { ok: false, error }
    }
}
