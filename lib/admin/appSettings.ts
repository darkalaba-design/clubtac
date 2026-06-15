import type { SupabaseClient } from '@supabase/supabase-js'

export const APP_SETTING_BROADCASTS_FOR_ADMINS = 'broadcasts_for_admins'

const MISSING_TABLE_MESSAGE =
    'Таблица clubtac_app_settings не создана. Откройте Supabase → SQL Editor и выполните файл supabase/migrations/20260609160000_clubtac_app_settings.sql'

function parseBooleanSetting(value: unknown): boolean {
    if (value === true) return true
    if (value === false) return false
    if (typeof value === 'string') return value.toLowerCase() === 'true'
    return false
}

function isMissingTableError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false
    const e = error as Record<string, unknown>
    if (e.code === '42P01') return true
    const message = typeof e.message === 'string' ? e.message : ''
    const m = message.toLowerCase()
    return (
        m.includes('clubtac_app_settings') &&
        (m.includes('does not exist') || m.includes('could not find the table') || m.includes('schema cache'))
    )
}

function errorMessage(error: unknown): string {
    if (typeof error === 'string' && error.trim()) return error.trim()
    if (isMissingTableError(error)) return MISSING_TABLE_MESSAGE
    if (error && typeof error === 'object') {
        const e = error as Record<string, unknown>
        const parts = ['message', 'details', 'hint', 'code']
            .map((key) => {
                const val = e[key]
                return typeof val === 'string' && val.trim() ? val.trim() : ''
            })
            .filter(Boolean)
        if (parts.length > 0) return parts.join(' · ')
    }
    return 'Не удалось сохранить настройку'
}

function wrapSettingsError(error: unknown): Error {
    return new Error(errorMessage(error))
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
    const settingKey = APP_SETTING_BROADCASTS_FOR_ADMINS

    const { data: existing, error: readErr } = await supabase
        .from('clubtac_app_settings')
        .select('key')
        .eq('key', settingKey)
        .maybeSingle()

    if (readErr) {
        throw wrapSettingsError(readErr)
    }

    if (existing) {
        const { error: updateErr } = await supabase
            .from('clubtac_app_settings')
            .update({ value: enabled, updated_at: now })
            .eq('key', settingKey)

        if (updateErr) throw wrapSettingsError(updateErr)
        return
    }

    const { error: insertErr } = await supabase.from('clubtac_app_settings').insert({
        key: settingKey,
        value: enabled,
        updated_at: now,
    })

    if (insertErr) throw wrapSettingsError(insertErr)
}
