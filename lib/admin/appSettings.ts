import type { SupabaseClient } from '@supabase/supabase-js'

export const APP_SETTING_BROADCASTS_FOR_ADMINS = 'broadcasts_for_admins'

function parseBooleanSetting(value: unknown): boolean {
    if (value === true) return true
    if (value === false) return false
    if (typeof value === 'string') return value.toLowerCase() === 'true'
    return false
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
    const { error } = await supabase.from('clubtac_app_settings').upsert({
        key: APP_SETTING_BROADCASTS_FOR_ADMINS,
        value: enabled,
        updated_at: new Date().toISOString(),
    })

    if (error) throw new Error(error.message)
}
