import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'
import {
    BOT_SETTINGS_SELECT,
    CLUBTAC_BOT_DATA_ROW_ID,
    canManageBotSettings,
    emptyBotSettings,
    normalizeBotSettingsRow,
    type BotSettingsField,
    type BotSettingsPayload,
} from '@/lib/admin/botSettings'

const PATCH_FIELDS: BotSettingsField[] = ['agent_instructions', 'tac_rules', 'tac_faq']

function parsePatchBody(body: Record<string, unknown>): Partial<BotSettingsPayload> | NextResponse {
    const patch: Partial<BotSettingsPayload> = {}
    for (const key of PATCH_FIELDS) {
        if (body[key] === undefined) continue
        if (typeof body[key] !== 'string') {
            return NextResponse.json({ error: `${key} должно быть строкой` }, { status: 400 })
        }
        patch[key] = body[key]
    }
    if (Object.keys(patch).length === 0) {
        return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 })
    }
    return patch
}

/** Настройки бота из clubtac_data (id=1) — только root. */
export async function GET(request: NextRequest) {
    const gate = await requireActor(request)
    if (!gate.ok) return gate.response

    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return blocked

    if (!canManageBotSettings(gate.actor.app_role)) {
        return NextResponse.json({ error: 'Только root может просматривать настройки бота' }, { status: 403 })
    }

    const { supabase } = gate
    const { data, error } = await supabase
        .from('clubtac_data')
        .select(BOT_SETTINGS_SELECT)
        .eq('id', CLUBTAC_BOT_DATA_ROW_ID)
        .maybeSingle()

    if (error) {
        console.error('GET /api/admin/bot-settings:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
        settings: normalizeBotSettingsRow(data as Record<string, unknown> | null),
    })
}

/** Обновление настроек бота в clubtac_data (id=1) — только root. */
export async function PATCH(request: NextRequest) {
    const gate = await requireActor(request)
    if (!gate.ok) return gate.response

    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return blocked

    if (!canManageBotSettings(gate.actor.app_role)) {
        return NextResponse.json({ error: 'Только root может менять настройки бота' }, { status: 403 })
    }

    let body: Record<string, unknown>
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Нужен JSON в теле запроса' }, { status: 400 })
    }

    const parsed = parsePatchBody(body)
    if (parsed instanceof NextResponse) return parsed

    const { supabase } = gate

    const { data: existing, error: readErr } = await supabase
        .from('clubtac_data')
        .select(BOT_SETTINGS_SELECT)
        .eq('id', CLUBTAC_BOT_DATA_ROW_ID)
        .maybeSingle()

    if (readErr) {
        console.error('PATCH /api/admin/bot-settings read:', readErr)
        return NextResponse.json({ error: readErr.message }, { status: 500 })
    }

    const merged: BotSettingsPayload = {
        ...normalizeBotSettingsRow(existing as Record<string, unknown> | null),
        ...parsed,
    }

    const writePayload = {
        id: CLUBTAC_BOT_DATA_ROW_ID,
        agent_instructions: merged.agent_instructions,
        tac_rules: merged.tac_rules,
        tac_faq: merged.tac_faq,
    }

    const { data: updated, error } = existing
        ? await supabase
              .from('clubtac_data')
              .update({
                  agent_instructions: writePayload.agent_instructions,
                  tac_rules: writePayload.tac_rules,
                  tac_faq: writePayload.tac_faq,
              })
              .eq('id', CLUBTAC_BOT_DATA_ROW_ID)
              .select(BOT_SETTINGS_SELECT)
              .maybeSingle()
        : await supabase.from('clubtac_data').insert(writePayload).select(BOT_SETTINGS_SELECT).maybeSingle()

    if (error) {
        console.error('PATCH /api/admin/bot-settings:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
        settings: normalizeBotSettingsRow((updated ?? writePayload) as Record<string, unknown>),
    })
}
