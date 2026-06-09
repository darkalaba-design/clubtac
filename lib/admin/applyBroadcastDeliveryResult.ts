import type { SupabaseClient } from '@supabase/supabase-js'
import { refreshBroadcastStats } from '@/lib/admin/broadcasts'

export async function applyBroadcastDeliveryResult(
    supabase: SupabaseClient,
    broadcastId: string,
    sentUserIds: number[]
): Promise<void> {
    const sentSet = new Set(sentUserIds.filter((id) => Number.isFinite(id) && id > 0))
    const now = new Date().toISOString()

    if (sentSet.size > 0) {
        const { error: sentErr } = await supabase
            .from('clubtac_broadcast_recipients')
            .update({ status: 'sent', sent_at: now, error_text: null })
            .eq('broadcast_id', broadcastId)
            .in('user_id', [...sentSet])

        if (sentErr) throw new Error(sentErr.message)
    }

    const { error: failErr } = await supabase
        .from('clubtac_broadcast_recipients')
        .update({ status: 'error', error_text: 'Не доставлено через Make' })
        .eq('broadcast_id', broadcastId)
        .eq('status', 'pending')

    if (failErr) throw new Error(failErr.message)

    await refreshBroadcastStats(supabase, broadcastId)
}
