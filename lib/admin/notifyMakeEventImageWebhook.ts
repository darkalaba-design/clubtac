/**
 * Вебхук Make.com для генерации обложки события.
 * URL можно переопределить через CLUBTAC_MAKE_EVENT_WEBHOOK_URL (например другой сценарий).
 * image_version позже будет задаваться из кода под тип сценария; сейчас по умолчанию board.
 */
const DEFAULT_WEBHOOK_URL = 'https://hook.eu2.make.com/azplmhe6sotr7gnj6zylkcljwofcr0xx'

export type EventImageWebhookPayload = {
    id: string
    title: string
    description: string | null
    type: string
    /** Пресет для генератора (board — игровая доска и т.п.) */
    imageVersion?: string
}

export function notifyMakeEventImageWebhook(event: EventImageWebhookPayload): void {
    const url = process.env.CLUBTAC_MAKE_EVENT_WEBHOOK_URL?.trim() || DEFAULT_WEBHOOK_URL
    if (!url) return

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
