'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { adminFetch } from '@/lib/admin/adminFetch'
import type { BotSettingsPayload } from '@/lib/admin/botSettings'

const fieldLabel: CSSProperties = {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1D1D1B',
    marginBottom: '6px',
}

const textareaStyle: CSSProperties = {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #EBE8E0',
    boxSizing: 'border-box',
    fontSize: '15px',
    lineHeight: 1.45,
    minHeight: '220px',
    resize: 'vertical',
    fontFamily: 'inherit',
}

type BotSubTab = 'instructions' | 'rules'

type Props = {
    onError?: (message: string | null) => void
}

export function AdminBotTab({ onError }: Props) {
    const [subTab, setSubTab] = useState<BotSubTab>('instructions')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState<string | null>(null)
    const [draft, setDraft] = useState<BotSettingsPayload>({
        agent_instructions: '',
        tac_rules: '',
        tac_faq: '',
    })

    const loadSettings = useCallback(async () => {
        setLoading(true)
        onError?.(null)
        try {
            const res = await adminFetch('/api/admin/bot-settings')
            const j = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(typeof j.error === 'string' ? j.error : res.statusText)
            const settings = j.settings as BotSettingsPayload | undefined
            setDraft({
                agent_instructions: settings?.agent_instructions ?? '',
                tac_rules: settings?.tac_rules ?? '',
                tac_faq: settings?.tac_faq ?? '',
            })
        } catch (e) {
            onError?.(e instanceof Error ? e.message : 'Не удалось загрузить настройки бота')
        } finally {
            setLoading(false)
        }
    }, [onError])

    useEffect(() => {
        void loadSettings()
    }, [loadSettings])

    const saveFields = async (fields: Partial<BotSettingsPayload>, successMessage: string) => {
        setSaving(true)
        setSuccess(null)
        onError?.(null)
        try {
            const res = await adminFetch('/api/admin/bot-settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fields),
            })
            const j = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(typeof j.error === 'string' ? j.error : res.statusText)
            const settings = j.settings as BotSettingsPayload | undefined
            if (settings) {
                setDraft({
                    agent_instructions: settings.agent_instructions ?? '',
                    tac_rules: settings.tac_rules ?? '',
                    tac_faq: settings.tac_faq ?? '',
                })
            }
            setSuccess(successMessage)
        } catch (e) {
            onError?.(e instanceof Error ? e.message : 'Не удалось сохранить')
        } finally {
            setSaving(false)
        }
    }

    const subTabBtn = (tab: BotSubTab, label: string) => (
        <button
            key={tab}
            type="button"
            onClick={() => {
                setSubTab(tab)
                setSuccess(null)
            }}
            style={{
                flex: 1,
                padding: '10px 8px',
                border: 'none',
                borderBottom: subTab === tab ? '3px solid #FFDF00' : '3px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
                fontWeight: subTab === tab ? 700 : 500,
                fontSize: '14px',
                color: subTab === tab ? '#1D1D1B' : '#6B6B69',
            }}
        >
            {label}
        </button>
    )

    return (
        <section style={{ padding: '0 12px 16px' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '17px' }}>Бот</h2>
            <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#6B6B69', lineHeight: 1.45 }}>
                Настройки текстов Telegram-бота.
            </p>

            <div
                style={{
                    display: 'flex',
                    borderBottom: '2px solid #EBE8E0',
                    marginBottom: '16px',
                }}
            >
                {subTabBtn('instructions', 'Инструкция')}
                {subTabBtn('rules', 'Правила игры')}
            </div>

            {loading ? (
                <p style={{ margin: 0, fontSize: '14px', color: '#6B6B69' }}>Загрузка…</p>
            ) : subTab === 'instructions' ? (
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        void saveFields(
                            { agent_instructions: draft.agent_instructions },
                            'Общая инструкция сохранена.'
                        )
                    }}
                >
                    <div style={{ marginBottom: '14px' }}>
                        <div style={fieldLabel}>Общая инструкция</div>
                        <textarea
                            value={draft.agent_instructions}
                            onChange={(e) =>
                                setDraft((prev) => ({ ...prev, agent_instructions: e.target.value }))
                            }
                            placeholder="Системный промпт и общие указания для агента бота…"
                            style={{ ...textareaStyle, minHeight: '320px' }}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={saving}
                        style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: saving ? '#A5D6A7' : '#1B5E20',
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: '15px',
                            cursor: saving ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {saving ? 'Сохранение…' : 'Сохранить инструкцию'}
                    </button>
                </form>
            ) : (
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        void saveFields(
                            { tac_rules: draft.tac_rules, tac_faq: draft.tac_faq },
                            'Правила и FAQ сохранены.'
                        )
                    }}
                >
                    <div style={{ marginBottom: '14px' }}>
                        <div style={fieldLabel}>Правила</div>
                        <textarea
                            value={draft.tac_rules}
                            onChange={(e) => setDraft((prev) => ({ ...prev, tac_rules: e.target.value }))}
                            placeholder="Правила игры для бота…"
                            style={textareaStyle}
                        />
                    </div>
                    <div style={{ marginBottom: '14px' }}>
                        <div style={fieldLabel}>Вопросы и ответы</div>
                        <textarea
                            value={draft.tac_faq}
                            onChange={(e) => setDraft((prev) => ({ ...prev, tac_faq: e.target.value }))}
                            placeholder="FAQ: вопросы и ответы…"
                            style={{ ...textareaStyle, minHeight: '280px' }}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={saving}
                        style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: saving ? '#A5D6A7' : '#1B5E20',
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: '15px',
                            cursor: saving ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {saving ? 'Сохранение…' : 'Сохранить правила и FAQ'}
                    </button>
                </form>
            )}

            {success ? (
                <p style={{ margin: '12px 0 0', fontSize: '13px', color: '#2E7D32', lineHeight: 1.45 }}>
                    {success}
                </p>
            ) : null}
        </section>
    )
}
