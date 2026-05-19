import { TELEGRAM_INIT_DATA_HEADER } from '@/lib/admin/constants'

function getInitDataHeader(): string {
    if (typeof window === 'undefined') return ''
    const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp
    return tg?.initData?.trim?.() || ''
}

export function adminFetch(input: RequestInfo | URL, init: RequestInit = {}) {
    const h = new Headers(init.headers)
    const id = getInitDataHeader()
    if (id) h.set(TELEGRAM_INIT_DATA_HEADER, id)
    return fetch(input, { ...init, headers: h })
}
