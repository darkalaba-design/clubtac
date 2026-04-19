import crypto from 'node:crypto'

/** Максимальный возраст initData (сек), защита от replay. */
const DEFAULT_MAX_AUTH_AGE_SEC = 24 * 60 * 60

export type ParsedWebAppInit = {
    params: Record<string, string>
    userId: number
    authDate: number
}

/**
 * Проверка подписи Telegram.WebApp.initData (Mini App).
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateWebAppInitData(
    initData: string,
    botToken: string,
    maxAuthAgeSec: number = DEFAULT_MAX_AUTH_AGE_SEC
): { ok: true; parsed: ParsedWebAppInit } | { ok: false; error: string } {
    const trimmed = initData?.trim()
    if (!trimmed) {
        return { ok: false, error: 'initData пустой' }
    }
    if (!botToken?.trim()) {
        return { ok: false, error: 'Не задан токен бота' }
    }

    const sp = new URLSearchParams(trimmed)
    const receivedHash = sp.get('hash')
    if (!receivedHash) {
        return { ok: false, error: 'В initData нет hash' }
    }

    // Для HMAC по токену бота в строку входят все поля, кроме hash (в т.ч. signature, если клиент его прислал).
    const pairs: [string, string][] = []
    sp.forEach((value, key) => {
        if (key !== 'hash') {
            pairs.push([key, value])
        }
    })
    pairs.sort(([a], [b]) => a.localeCompare(b))
    const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join('\n')

    // Ключ — строка "WebAppData", сообщение — токен бота (см. доку Telegram)
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
    const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

    const a = Buffer.from(computedHash, 'hex')
    const b = Buffer.from(receivedHash, 'hex')
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return { ok: false, error: 'Неверная подпись initData' }
    }

    const authDateRaw = sp.get('auth_date')
    const authDate = authDateRaw ? parseInt(authDateRaw, 10) : NaN
    if (!Number.isFinite(authDate)) {
        return { ok: false, error: 'Нет или неверный auth_date' }
    }
    const now = Math.floor(Date.now() / 1000)
    if (now - authDate > maxAuthAgeSec) {
        return { ok: false, error: 'initData устарел (auth_date)' }
    }

    const userJson = sp.get('user')
    if (!userJson) {
        return { ok: false, error: 'В initData нет user' }
    }
    let userId: number
    try {
        const user = JSON.parse(userJson) as { id?: number }
        userId = Number(user.id)
        if (!Number.isFinite(userId) || userId <= 0) {
            return { ok: false, error: 'Неверный user.id в initData' }
        }
    } catch {
        return { ok: false, error: 'Не удалось разобрать user в initData' }
    }

    const params: Record<string, string> = {}
    sp.forEach((v, k) => {
        params[k] = v
    })

    return { ok: true, parsed: { params, userId, authDate } }
}
