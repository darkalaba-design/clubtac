import type { SupabaseClient } from '@supabase/supabase-js'

export type BroadcastAudience = 'all' | 'admins' | 'vip' | 'standard'

export type BroadcastStatus =
    | 'pending'
    | 'sending'
    | 'completed'
    | 'partial_error'
    | 'error'
    | 'cancelled'

export type BroadcastRecipientStatus = 'pending' | 'sent' | 'error'

export type BroadcastRow = {
    id: string
    created_at: string
    created_by_user_id: number
    message: string
    audience: BroadcastAudience
    status: BroadcastStatus
    total_recipients: number
    sent_count: number
    error_count: number
    make_triggered_at: string | null
    completed_at: string | null
}

export type BroadcastRecipientRow = {
    id: string
    broadcast_id: string
    user_id: number
    telegram_id: number
    message_id: string | null
    status: BroadcastRecipientStatus
    error_text: string | null
    created_at: string
    sent_at: string | null
}

export const BROADCAST_AUDIENCES: readonly BroadcastAudience[] = ['all', 'admins', 'vip', 'standard']

export function parseBroadcastAudience(raw: unknown): BroadcastAudience | null {
    if (raw === 'all' || raw === 'admins' || raw === 'vip' || raw === 'standard') return raw
    return null
}

export function broadcastAudienceLabel(audience: BroadcastAudience): string {
    switch (audience) {
        case 'admins':
            return 'Только админы'
        case 'vip':
            return 'Участники (VIP)'
        case 'standard':
            return 'Гости (стандарт)'
        default:
            return 'Все активные игроки'
    }
}

export function broadcastStatusLabel(status: BroadcastStatus): string {
    switch (status) {
        case 'pending':
            return 'Ожидает'
        case 'sending':
            return 'Отправка…'
        case 'completed':
            return 'Завершена'
        case 'partial_error':
            return 'Завершена с ошибками'
        case 'error':
            return 'Ошибка'
        case 'cancelled':
            return 'Отменена'
        default:
            return status
    }
}

export function getBroadcastDeliveryMode(): 'make' | 'app' {
    return process.env.CLUBTAC_MAKE_BROADCAST_WEBHOOK_URL?.trim() ? 'make' : 'app'
}

type AudienceUser = { id: number; telegram_id: number }

export async function resolveBroadcastAudience(
    supabase: SupabaseClient,
    audience: BroadcastAudience
): Promise<AudienceUser[]> {
    let query = supabase
        .from('clubtac_users')
        .select('id, telegram_id')
        .eq('is_active', true)
        .gt('telegram_id', 0)

    if (audience === 'admins') {
        query = query.in('app_role', ['admin', 'root'])
    } else if (audience === 'vip') {
        query = query.eq('status', 'vip')
    } else if (audience === 'standard') {
        query = query.or('status.is.null,status.eq.standard')
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)

    return (data ?? [])
        .map((row) => ({
            id: Number((row as { id: unknown }).id),
            telegram_id: Number((row as { telegram_id: unknown }).telegram_id),
        }))
        .filter((row) => Number.isFinite(row.id) && row.id > 0 && Number.isFinite(row.telegram_id) && row.telegram_id > 0)
}

export async function countBroadcastAudience(
    supabase: SupabaseClient,
    audience: BroadcastAudience
): Promise<number> {
    const users = await resolveBroadcastAudience(supabase, audience)
    return users.length
}

export async function refreshBroadcastStats(supabase: SupabaseClient, broadcastId: string): Promise<void> {
    const { data: rows, error } = await supabase
        .from('clubtac_broadcast_recipients')
        .select('status')
        .eq('broadcast_id', broadcastId)

    if (error) throw new Error(error.message)

    const list = rows ?? []
    const total = list.length
    const sent_count = list.filter((r) => (r as { status: string }).status === 'sent').length
    const error_count = list.filter((r) => (r as { status: string }).status === 'error').length
    const pending = list.filter((r) => (r as { status: string }).status === 'pending').length

    let status: BroadcastStatus = 'sending'
    if (pending === 0 && total > 0) {
        if (error_count === 0) status = 'completed'
        else if (sent_count === 0) status = 'error'
        else status = 'partial_error'
    } else if (total === 0) {
        status = 'error'
    }

    const patch: Record<string, unknown> = {
        total_recipients: total,
        sent_count,
        error_count,
        status,
    }
    if (pending === 0 && total > 0) {
        patch.completed_at = new Date().toISOString()
    }

    const { error: updateErr } = await supabase.from('clubtac_broadcasts').update(patch).eq('id', broadcastId)
    if (updateErr) throw new Error(updateErr.message)
}

export async function insertBroadcastRecipients(
    supabase: SupabaseClient,
    broadcastId: string,
    users: AudienceUser[]
): Promise<void> {
    const chunkSize = 200
    for (let i = 0; i < users.length; i += chunkSize) {
        const chunk = users.slice(i, i + chunkSize).map((u) => ({
            broadcast_id: broadcastId,
            user_id: u.id,
            telegram_id: u.telegram_id,
            status: 'pending' as const,
        }))
        const { error } = await supabase.from('clubtac_broadcast_recipients').insert(chunk)
        if (error) throw new Error(error.message)
    }
}
