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

export function paymentStatusLabelRu(status: string): string {
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
