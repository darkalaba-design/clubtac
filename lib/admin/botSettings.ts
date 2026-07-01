import type { AppRole } from '@/lib/admin/appRole'

/** Строка clubtac_data id=1 — промпты и тексты для Telegram-бота. */
export const CLUBTAC_BOT_DATA_ROW_ID = 1

export type BotSettingsPayload = {
    agent_instructions: string
    tac_rules: string
    tac_faq: string
}

export type BotSettingsField = keyof BotSettingsPayload

export const BOT_SETTINGS_SELECT = 'id, agent_instructions, tac_rules, tac_faq'

export function emptyBotSettings(): BotSettingsPayload {
    return {
        agent_instructions: '',
        tac_rules: '',
        tac_faq: '',
    }
}

export function normalizeBotSettingsRow(row: Record<string, unknown> | null | undefined): BotSettingsPayload {
    if (!row) return emptyBotSettings()
    return {
        agent_instructions: typeof row.agent_instructions === 'string' ? row.agent_instructions : '',
        tac_rules: typeof row.tac_rules === 'string' ? row.tac_rules : '',
        tac_faq: typeof row.tac_faq === 'string' ? row.tac_faq : '',
    }
}

export function canManageBotSettings(role: AppRole): boolean {
    return role === 'root'
}
