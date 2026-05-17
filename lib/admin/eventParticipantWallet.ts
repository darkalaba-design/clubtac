import { isUuid } from '@/lib/uuid'

export type EventParticipantRow = {
    id: string | number
    order_id?: string | null
    event_id: string
    user_id: number
    payment_status: string
    price_paid: number | null
}

/** order_id в кошельке — UUID: id участника (если UUID) или order_id записи участника. */
export function walletOrderIdFromParticipant(row: Pick<EventParticipantRow, 'id' | 'order_id'>): string | null {
    const idStr = row.id != null ? String(row.id).trim() : ''
    if (isUuid(idStr)) return idStr
    if (row.order_id != null && isUuid(row.order_id)) return String(row.order_id).trim()
    return null
}

export function participantRefundAmount(price_paid: number | null | undefined): number {
    const n = Number(price_paid)
    if (!Number.isFinite(n) || n === 0) return 0
    return n
}
