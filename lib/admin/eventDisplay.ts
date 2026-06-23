/** День и месяц + время для карточки в админке (например «25 января, 16:30»). */
export function formatEventCardDayMonthAndTime(iso: string): string {
    try {
        const date = new Date(iso)
        if (Number.isNaN(date.getTime())) return iso
        const dayMonth = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
        const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false })
        return `${dayMonth}, ${time}`
    } catch {
        return iso
    }
}

/** «25 января» — число и месяц в родительном падеже (локаль ru). */
export function formatEventCardDayMonth(iso: string): string {
    try {
        const date = new Date(iso)
        if (Number.isNaN(date.getTime())) return iso
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    } catch {
        return iso
    }
}

/** Полная строка для модалки: день месяц, день недели, время */
export function formatEventModalDateTime(iso: string): string {
    try {
        const date = new Date(iso)
        if (Number.isNaN(date.getTime())) return iso
        const dayMonth = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
        const weekdayRaw = date.toLocaleDateString('ru-RU', { weekday: 'short' })
        const weekday = weekdayRaw.replace(/\.$/, '').toUpperCase()
        const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false })
        return `${dayMonth}, ${weekday}. ${time}`
    } catch {
        return iso
    }
}

export function getEventTypeNameRu(type: string): string {
    switch (type) {
        case 'game':
            return 'Игра'
        case 'workshop':
            return 'Мастер-класс'
        case 'party':
            return 'Вечеринка'
        default:
            return type
    }
}

function isFreeParticipantPrice(pricePaid: number | null | undefined): boolean {
    if (pricePaid == null) return false
    const n = Number(pricePaid)
    return Number.isFinite(n) && n === 0
}

export function paymentStatusBadgeStyle(
    status: string,
    pricePaid?: number | null
): { backgroundColor: string; color: string } {
    if (status === 'paid' && isFreeParticipantPrice(pricePaid)) {
        return { backgroundColor: '#E3F2FD', color: '#1565C0' }
    }
    switch (status) {
        case 'paid':
            return { backgroundColor: '#E8F5E9', color: '#1B5E20' }
        case 'pending':
            return { backgroundColor: '#FFF9E6', color: '#6D4C00' }
        default:
            return { backgroundColor: '#F0EFEB', color: '#6B6B69' }
    }
}

export function paymentStatusLabelRu(status: string, pricePaid?: number | null): string {
    if (status === 'paid' && isFreeParticipantPrice(pricePaid)) {
        return 'Бесплатно'
    }
    switch (status) {
        case 'paid':
            return 'Оплачено'
        case 'pending':
            return 'Ожидает оплаты'
        case 'canceled':
            return 'Исключён'
        case 'cancelled':
            return 'Отменено'
        default:
            return status
    }
}

/** Статус события в clubtac_events (для админки). */
export function eventStatusLabelRu(status: string): string {
    switch (status) {
        case 'scheduled':
            return 'Запланировано'
        case 'finished':
            return 'Завершено'
        case 'cancelled':
            return 'Отменено'
        case 'hidden':
            return 'Скрыто (только в админке)'
        default:
            return status
    }
}

/** Событие уже прошло по дате начала (status в БД часто остаётся scheduled). */
export function isEventStartedInPast(iso: string, nowMs = Date.now()): boolean {
    const t = new Date(iso).getTime()
    return Number.isFinite(t) && t < nowMs
}

/** Завершённое мероприятие для админки: явный finished или дата в прошлом (кроме отменённых/скрытых). */
export function isAdminEventCompleted(ev: { status: string; starts_at: string }): boolean {
    const st = ev.status
    if (st === 'cancelled' || st === 'canceled' || st === 'hidden') return false
    if (st === 'finished') return true
    return isEventStartedInPast(ev.starts_at)
}
