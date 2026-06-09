import type { SupabaseClient } from '@supabase/supabase-js'
import { refreshBroadcastStats } from '@/lib/admin/broadcasts'
import { sendAdminPlayerMessageViaMake } from '@/lib/admin/sendAdminPlayerMessageViaMake'

const MESSAGE_SELECT = 'id'

type PendingRecipient = {
    id: string
    user_id: number
    telegram_id: number
}

/** Отправляет следующую порцию получателей через тот же webhook, что и чат 1:1. */
export async function processBroadcastBatch(
    supabase: SupabaseClient,
    broadcastId: string,
    limit = 8
): Promise<{ processed: number; done: boolean }> {
    const { data: broadcast, error: broadcastErr } = await supabase
        .from('clubtac_broadcasts')
        .select('id, message, status')
        .eq('id', broadcastId)
        .maybeSingle()

    if (broadcastErr) throw new Error(broadcastErr.message)
    if (!broadcast) throw new Error('Рассылка не найдена')

    const status = String((broadcast as { status: string }).status)
    if (status === 'completed' || status === 'error' || status === 'cancelled') {
        return { processed: 0, done: true }
    }

    if (status === 'pending') {
        await supabase.from('clubtac_broadcasts').update({ status: 'sending' }).eq('id', broadcastId)
    }

    const messageText = String((broadcast as { message: string }).message)

    const { data: pending, error: pendingErr } = await supabase
        .from('clubtac_broadcast_recipients')
        .select('id, user_id, telegram_id')
        .eq('broadcast_id', broadcastId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(limit)

    if (pendingErr) throw new Error(pendingErr.message)

    const rows = (pending ?? []) as PendingRecipient[]
    if (rows.length === 0) {
        await refreshBroadcastStats(supabase, broadcastId)
        return { processed: 0, done: true }
    }

    let processed = 0
    for (const row of rows) {
        const { data: inserted, error: insertErr } = await supabase
            .from('clubtac_messages')
            .insert({
                user_id: row.user_id,
                message: messageText,
                sender: 'admin',
                status: 'draft',
            })
            .select(MESSAGE_SELECT)
            .single()

        if (insertErr || !inserted) {
            await supabase
                .from('clubtac_broadcast_recipients')
                .update({
                    status: 'error',
                    error_text: insertErr?.message ?? 'Не удалось сохранить сообщение',
                })
                .eq('id', row.id)
            processed++
            continue
        }

        const messageId = String((inserted as { id: unknown }).id)
        const makeResult = await sendAdminPlayerMessageViaMake({
            telegram_id: row.telegram_id,
            message_id: messageId,
        })

        if (!makeResult.ok) {
            await supabase.from('clubtac_messages').update({ status: 'error' }).eq('id', messageId)
            await supabase
                .from('clubtac_broadcast_recipients')
                .update({
                    status: 'error',
                    message_id: messageId,
                    error_text: makeResult.error,
                })
                .eq('id', row.id)
        } else {
            await supabase
                .from('clubtac_broadcast_recipients')
                .update({
                    status: 'sent',
                    message_id: messageId,
                    sent_at: new Date().toISOString(),
                })
                .eq('id', row.id)
        }

        processed++
    }

    await refreshBroadcastStats(supabase, broadcastId)

    const { data: updated } = await supabase
        .from('clubtac_broadcasts')
        .select('status')
        .eq('id', broadcastId)
        .maybeSingle()

    const nextStatus = String((updated as { status?: string } | null)?.status ?? 'sending')
    const done = nextStatus !== 'pending' && nextStatus !== 'sending'
    return { processed, done }
}
