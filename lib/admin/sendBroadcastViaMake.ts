export type MakeBroadcastPayload = {
    broadcast_id: string
}

export type MakeBroadcastResult = { ok: true } | { ok: false; error: string; httpStatus?: number }

export function getMakeBroadcastWebhookUrl(): string | null {
    const url = process.env.CLUBTAC_MAKE_BROADCAST_WEBHOOK_URL?.trim()
    return url || null
}

/** Запуск сценария Make для массовой рассылки по broadcast_id. */
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
