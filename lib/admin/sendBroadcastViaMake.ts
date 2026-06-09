import { getMakeBroadcastWebhookUrl } from '@/lib/makeWebhooks'
import { parseMakeBroadcastResponse } from '@/lib/admin/parseMakeBroadcastResponse'

export type MakeBroadcastPayload = {
    broadcast_id: string
}

export type MakeBroadcastResult =
    | { ok: true; mode: 'completed'; sentUserIds: number[] }
    | { ok: true; mode: 'triggered' }
    | { ok: false; error: string; httpStatus?: number }

export { getMakeBroadcastWebhookUrl }

/** Сколько ждём ответ Make в POST (serverless). Дольше — сценарий считаем фоновым. */
const MAKE_WEBHOOK_TIMEOUT_MS = 15_000

/**
 * Запуск сценария Make для массовой рассылки.
 * — Если Make успел вернуть список id → mode: completed.
 * — Если таймаут или «accepted» → mode: triggered (ждём callback / обновления в БД).
 */
export async function sendBroadcastViaMake(payload: MakeBroadcastPayload): Promise<MakeBroadcastResult> {
    const url = getMakeBroadcastWebhookUrl()
    if (!url) {
        return { ok: false, error: 'CLUBTAC_MAKE_BROADCAST_WEBHOOK_URL не задан' }
    }

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ broadcast_id: payload.broadcast_id }),
            signal: AbortSignal.timeout(MAKE_WEBHOOK_TIMEOUT_MS),
        })

        const text = (await res.text().catch(() => '')).trim()

        if (!res.ok) {
            return {
                ok: false,
                httpStatus: res.status,
                error: text || `Make.com вернул ошибку (${res.status})`,
            }
        }

        const parsed = parseMakeBroadcastResponse(text)
        if ('error' in parsed) {
            const lower = text.toLowerCase()
            if (!text || lower === 'accepted' || lower === 'ok') {
                return { ok: true, mode: 'triggered' }
            }
            return { ok: false, error: parsed.error }
        }

        if (parsed.sentUserIds.length === 0) {
            return { ok: true, mode: 'triggered' }
        }

        return { ok: true, mode: 'completed', sentUserIds: parsed.sentUserIds }
    } catch (e) {
        if (isFetchTimeout(e)) {
            return { ok: true, mode: 'triggered' }
        }
        const msg = e instanceof Error ? e.message : 'Не удалось вызвать Make.com'
        return { ok: false, error: msg }
    }
}

function isFetchTimeout(e: unknown): boolean {
    if (!(e instanceof Error)) return false
    return e.name === 'TimeoutError' || e.name === 'AbortError' || /timed?\s*out/i.test(e.message)
}
