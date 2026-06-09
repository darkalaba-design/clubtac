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

export function notifyMakeEventImageWebhook(event: EventImageWebhookPayload): void {
    const url = getMakeEventCoverWebhookUrl()
    if (!url) {
        console.error(
            'notifyMakeEventImageWebhook: не задан CLUBTAC_MAKE_EVENT_COVER_WEBHOOK_URL'
        )
        return
    }

    const body = {
        event_id: event.id,
        event_desc: event.description ?? '',
        event_name: event.title,
        event_type: event.type,
        image_version: event.imageVersion ?? 'board',
    }

    void fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
    }).catch((err: unknown) => {
        console.error('notifyMakeEventImageWebhook:', err)
    })
}
