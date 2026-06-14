import type { SupabaseClient } from '@supabase/supabase-js'

export const APP_SETTING_BROADCASTS_FOR_ADMINS = 'broadcasts_for_admins'

function parseBooleanSetting(value: unknown): boolean {
    if (value === true) return true
    if (value === false) return false
    if (typeof value === 'string') return value.toLowerCase() === 'true'
    return false
}

function isMissingSettingsTableError(message: string | undefined | null): boolean {
    if (!message) return false
    const m = message.toLowerCase()
    return (
        m.includes('clubtac_app_settings') &&
        (m.includes('does not exist') || m.includes('could not find the table') || m.includes('schema cache'))
    )
}

function errorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) {
        const msg = (error as { message?: unknown }).message
        if (typeof msg === 'string' && msg.trim()) return msg.trim()
    }
    return 'Не удалось сохранить настройку'
}

function wrapSettingsError(error: unknown): Error {
    const message = errorMessage(error)
    if (isMissingSettingsTableError(message)) {
        return new Error(
            'Таблица clubtac_app_settings не найдена. Примените миграцию 20260609160000_clubtac_app_settings.sql в Supabase.'
        )
    }
    return new Error(message)
}

export async function getBroadcastsForAdminsEnabled(supabase: SupabaseClient): Promise<boolean> {
    const { data, error } = await supabase
        .from('clubtac_app_settings')
        .select('value')
        .eq('key', APP_SETTING_BROADCASTS_FOR_ADMINS)
        .maybeSingle()

    if (error) {
        console.error('getBroadcastsForAdminsEnabled:', error)
        return false
    }

    return parseBooleanSetting((data as { value?: unknown } | null)?.value)
}

export async function setBroadcastsForAdminsEnabled(
    supabase: SupabaseClient,
    enabled: boolean
): Promise<void> {
    const now = new Date().toISOString()
    const row = {
        key: APP_SETTING_BROADCASTS_FOR_ADMINS,
        value: enabled,
        updated_at: now,
    }

    const { error: upsertErr } = await supabase
        .from('clubtac_app_settings')
        .upsert(row, { onConflict: 'key' })

    if (upsertErr) throw wrapSettingsError(upsertErr)
}
