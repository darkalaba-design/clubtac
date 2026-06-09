function parseUserIds(raw: unknown[]): number[] {
    return [
        ...new Set(
            raw
                .map((v) => Number.parseInt(String(v), 10))
                .filter((id) => Number.isFinite(id) && id > 0)
        ),
    ]
}

export type ParsedMakeBroadcastResponse =
    | { sentUserIds: number[] }
    | { error: string }

/** Разбор тела ответа Make: JSON или список id через запятую. */
export function parseMakeBroadcastResponse(body: string): ParsedMakeBroadcastResponse {
    const trimmed = body.trim()
    if (!trimmed) {
        return { error: 'Make вернул пустой ответ' }
    }

    const lower = trimmed.toLowerCase()
    if (lower === 'error') {
        return { error: 'Make сообщил об ошибке рассылки' }
    }
    if (lower === 'accepted' || lower === 'ok') {
        return { sentUserIds: [] }
    }

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            const parsed: unknown = JSON.parse(trimmed)
            if (Array.isArray(parsed)) {
                const sentUserIds = parseUserIds(parsed)
                return sentUserIds.length > 0
                    ? { sentUserIds }
                    : { error: 'Make вернул пустой список получателей' }
            }
            if (parsed && typeof parsed === 'object') {
                const obj = parsed as Record<string, unknown>
                const rawIds = obj.sent_user_ids ?? obj.sentUserIds ?? obj.user_ids ?? obj.userIds
                if (Array.isArray(rawIds)) {
                    const sentUserIds = parseUserIds(rawIds)
                    return sentUserIds.length > 0
                        ? { sentUserIds }
                        : { error: 'Make вернул пустой список получателей' }
                }
                if (typeof rawIds === 'string' && rawIds.trim()) {
                    return parseMakeBroadcastResponse(rawIds)
                }
            }
        } catch {
            /* пробуем как текст ниже */
        }
    }

    const sentUserIds = parseUserIds(trimmed.split(/[,;\s]+/))
    if (sentUserIds.length === 0) {
        return { error: 'Не удалось разобрать список id из ответа Make' }
    }
    return { sentUserIds }
}
