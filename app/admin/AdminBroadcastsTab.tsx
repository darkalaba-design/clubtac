'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { adminFetch } from '@/lib/admin/adminFetch'
import {
    BROADCAST_AUDIENCES,
    broadcastAudienceLabel,
    broadcastStatusLabel,
    type BroadcastAudience,
    type BroadcastRow,
} from '@/lib/admin/broadcasts'
import {
    AdminPlayerSearchField,
    adminPlayerDisplayName,
    type AdminPlayerOption,
} from './AdminPlayerSearchField'

const fieldLabel: CSSProperties = {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1D1D1B',
    marginBottom: '4px',
}

const chipStyle = (active: boolean): CSSProperties => ({
    padding: '6px 11px',
    fontSize: '12px',
    borderRadius: '999px',
    border: active ? '2px solid #1B5E20' : '1px solid #EBE8E0',
    backgroundColor: active ? '#E8F5E9' : '#FFFFFF',
    color: '#1D1D1B',
    cursor: 'pointer',
    fontWeight: active ? 600 : 500,
})

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    } catch {
        return iso
    }
}

function progressPercent(b: BroadcastRow): number {
    if (!b.total_recipients) return 0
    return Math.round(((b.sent_count + b.error_count) / b.total_recipients) * 100)
}

function isInProgress(status: BroadcastRow['status']): boolean {
    return status === 'pending' || status === 'sending'
}

function broadcastHistoryAudienceLabel(b: BroadcastRow): string {
    if (b.audience === 'manual') {
        return `Выбрано вручную (${b.total_recipients})`
    }
    return broadcastAudienceLabel(b.audience)
}

type Props = {
    onError?: (message: string | null) => void
}

export function AdminBroadcastsTab({ onError }: Props) {
    const [webhookConfigured, setWebhookConfigured] = useState(true)
    const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([])
    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState('')
    const [audience, setAudience] = useState<BroadcastAudience>('all')
    const [audienceCount, setAudienceCount] = useState<number | null>(null)
    const [audienceCountLoading, setAudienceCountLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [players, setPlayers] = useState<AdminPlayerOption[]>([])
    const [selectedPlayers, setSelectedPlayers] = useState<AdminPlayerOption[]>([])
    const [pickerKey, setPickerKey] = useState(0)
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const loadList = useCallback(async () => {
        setLoading(true)
        onError?.(null)
        try {
            const res = await adminFetch('/api/admin/broadcasts')
            const j = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(typeof j.error === 'string' ? j.error : res.statusText)
            setBroadcasts((j.broadcasts as BroadcastRow[]) ?? [])
            setWebhookConfigured(j.delivery_mode !== 'unset')
        } catch (e) {
            onError?.(e instanceof Error ? e.message : 'Не удалось загрузить рассылки')
        } finally {
            setLoading(false)
        }
    }, [onError])

    const refreshBroadcast = useCallback(async (id: string) => {
        const res = await adminFetch(`/api/admin/broadcasts/${id}`)
        const j = await res.json().catch(() => ({}))
        if (!res.ok) return null
        const row = j.broadcast as BroadcastRow
        if (row) {
            setBroadcasts((prev) => {
                const idx = prev.findIndex((b) => b.id === row.id)
                if (idx < 0) return [row, ...prev]
                const next = [...prev]
                next[idx] = row
                return next
            })
        }
        return row as BroadcastRow | null
    }, [])

    useEffect(() => {
        void loadList()
    }, [loadList])

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const res = await adminFetch('/api/admin/players?limit=1000')
                const j = await res.json().catch(() => ({}))
                if (!cancelled && res.ok) {
                    const rows = (j.players as Array<Record<string, unknown>>) ?? []
                    setPlayers(
                        rows.map((p) => ({
                            user_id: Number(p.user_id),
                            telegram_id:
                                p.telegram_id != null ? Number(p.telegram_id) : undefined,
                            first_name: (p.first_name as string | null) ?? null,
                            last_name: (p.last_name as string | null) ?? null,
                            username: (p.username as string | null) ?? null,
                            nickname: (p.nickname as string | null) ?? null,
                            takoff: !!p.takoff,
                        }))
                    )
                }
            } catch {
                /* список для ручного выбора — не блокируем вкладку */
            }
        })()
        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        if (audience === 'manual') {
            setAudienceCount(selectedPlayers.length)
            setAudienceCountLoading(false)
            return
        }

        let cancelled = false
        setAudienceCountLoading(true)
        ;(async () => {
            try {
                const res = await adminFetch(`/api/admin/broadcasts?audience=${audience}`)
                const j = await res.json().catch(() => ({}))
                if (!cancelled && res.ok) setAudienceCount(typeof j.count === 'number' ? j.count : null)
            } catch {
                if (!cancelled) setAudienceCount(null)
            } finally {
                if (!cancelled) setAudienceCountLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [audience, selectedPlayers.length])

    useEffect(() => {
        const active = broadcasts.find((b) => isInProgress(b.status))
        if (!active) {
            if (pollRef.current) {
                clearInterval(pollRef.current)
                pollRef.current = null
            }
            return
        }

        const tick = () => {
            void refreshBroadcast(active.id)
        }
        void tick()
        pollRef.current = setInterval(tick, 2500)
        return () => {
            if (pollRef.current) clearInterval(pollRef.current)
        }
    }, [broadcasts, refreshBroadcast])

    const submit = async () => {
        const text = message.trim()
        if (!text) {
            onError?.('Введите текст сообщения')
            return
        }
        if (audienceCount === 0) {
            onError?.(
                audience === 'manual'
                    ? 'Выберите хотя бы одного игрока'
                    : 'Нет получателей для выбранной аудитории'
            )
            return
        }

        setSubmitting(true)
        onError?.(null)
        try {
            const payload: { message: string; audience: BroadcastAudience; user_ids?: number[] } = {
                message: text,
                audience,
            }
            if (audience === 'manual') {
                payload.user_ids = selectedPlayers.map((p) => p.user_id)
            }

            const res = await adminFetch('/api/admin/broadcasts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const j = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(typeof j.error === 'string' ? j.error : res.statusText)
            const created = j.broadcast as BroadcastRow
            setWebhookConfigured(true)
            setBroadcasts((prev) => [created, ...prev])
            setMessage('')
            if (audience === 'manual') {
                setSelectedPlayers([])
                setPickerKey((k) => k + 1)
            }
            setExpandedId(created.id)
        } catch (e) {
            onError?.(e instanceof Error ? e.message : 'Не удалось создать рассылку')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div>
            <h2 style={{ margin: '0 0 6px', fontSize: '17px' }}>Рассылки</h2>
            <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#6B6B69', lineHeight: 1.45 }}>
                Массовая отправка через Make:{' '}
                <code style={{ fontSize: '11px' }}>CLUBTAC_MAKE_BROADCAST_WEBHOOK_URL</code>.
                {!webhookConfigured ? (
                    <>
                        {' '}
                        <span style={{ color: '#B71C1C', fontWeight: 600 }}>
                            Webhook не задан — рассылка недоступна.
                        </span>
                    </>
                ) : null}
            </p>

            <div
                style={{
                    padding: '14px',
                    borderRadius: '12px',
                    border: '1px solid #EBE8E0',
                    backgroundColor: '#FAFAF8',
                    marginBottom: '20px',
                }}
            >
                <div style={{ marginBottom: '12px' }}>
                    <div style={fieldLabel}>Сообщение</div>
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={4}
                        placeholder="Текст рассылки…"
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid #EBE8E0',
                            fontSize: '15px',
                            boxSizing: 'border-box',
                            resize: 'vertical',
                            fontFamily: 'inherit',
                        }}
                    />
                </div>

                <div style={{ marginBottom: '12px' }}>
                    <div style={fieldLabel}>Кому отправить</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {BROADCAST_AUDIENCES.map((key) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setAudience(key)}
                                style={chipStyle(audience === key)}
                            >
                                {broadcastAudienceLabel(key)}
                            </button>
                        ))}
                    </div>
                    <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#6B6B69' }}>
                        Получателей:{' '}
                        {audienceCountLoading
                            ? '…'
                            : audienceCount != null
                              ? audienceCount
                              : '—'}
                    </p>

                    {audience === 'manual' ? (
                        <div style={{ marginTop: '12px' }}>
                            <AdminPlayerSearchField
                                key={pickerKey}
                                label="Добавить"
                                players={players}
                                excludeUserIds={selectedPlayers.map((p) => p.user_id)}
                                value={null}
                                onChange={(p) => {
                                    if (!p) return
                                    setSelectedPlayers((prev) => {
                                        if (prev.some((x) => x.user_id === p.user_id)) return prev
                                        return [...prev, p]
                                    })
                                    setPickerKey((k) => k + 1)
                                }}
                                disabled={submitting}
                            />
                            {selectedPlayers.length > 0 ? (
                                <div
                                    style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '6px',
                                        marginTop: '4px',
                                    }}
                                >
                                    {selectedPlayers.map((p) => (
                                        <span
                                            key={p.user_id}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '4px 8px',
                                                borderRadius: '999px',
                                                backgroundColor: '#E8F5E9',
                                                border: '1px solid #C8E6C9',
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                color: '#1D1D1B',
                                            }}
                                        >
                                            {adminPlayerDisplayName(p)}
                                            <button
                                                type="button"
                                                aria-label={`Убрать ${adminPlayerDisplayName(p)}`}
                                                disabled={submitting}
                                                onClick={() =>
                                                    setSelectedPlayers((prev) =>
                                                        prev.filter((x) => x.user_id !== p.user_id)
                                                    )
                                                }
                                                style={{
                                                    border: 'none',
                                                    background: 'transparent',
                                                    padding: 0,
                                                    cursor: submitting ? 'not-allowed' : 'pointer',
                                                    fontSize: '14px',
                                                    lineHeight: 1,
                                                    color: '#6B6B69',
                                                }}
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#6B6B69' }}>
                                    Найдите игрока по нику, имени или id и добавьте в список.
                                </p>
                            )}
                        </div>
                    ) : null}
                </div>

                <button
                    type="button"
                    disabled={
                        submitting ||
                        !webhookConfigured ||
                        !message.trim() ||
                        audienceCount === 0 ||
                        (audience === 'manual' && selectedPlayers.length === 0)
                    }
                    onClick={() => void submit()}
                    style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '10px',
                        border: 'none',
                        backgroundColor: submitting ? '#EBE8E0' : '#FFDF00',
                        color: '#1D1D1B',
                        fontWeight: 700,
                        fontSize: '15px',
                        cursor: submitting ? 'wait' : 'pointer',
                    }}
                >
                    {submitting ? 'Запуск…' : 'Отправить рассылку'}
                </button>
            </div>

            <h3 style={{ margin: '0 0 10px', fontSize: '15px', fontWeight: 700 }}>История</h3>

            {loading ? (
                <p style={{ margin: 0, fontSize: '14px', color: '#6B6B69' }}>Загрузка…</p>
            ) : broadcasts.length === 0 ? (
                <p style={{ margin: 0, fontSize: '14px', color: '#6B6B69' }}>Рассылок пока не было.</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {broadcasts.map((b) => {
                        const pct = progressPercent(b)
                        const expanded = expandedId === b.id
                        return (
                            <div
                                key={b.id}
                                style={{
                                    border: '1px solid #EBE8E0',
                                    borderRadius: '10px',
                                    overflow: 'hidden',
                                    backgroundColor: '#FFFFFF',
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => setExpandedId(expanded ? null : b.id)}
                                    style={{
                                        width: '100%',
                                        border: 'none',
                                        background: 'transparent',
                                        padding: '12px 14px',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            gap: '10px',
                                            alignItems: 'flex-start',
                                        }}
                                    >
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div
                                                style={{
                                                    fontSize: '14px',
                                                    fontWeight: 600,
                                                    color: '#1D1D1B',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {b.message}
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#6B6B69', marginTop: '4px' }}>
                                                {formatDate(b.created_at)} · {broadcastHistoryAudienceLabel(b)}
                                            </div>
                                        </div>
                                        <span
                                            style={{
                                                flexShrink: 0,
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                padding: '3px 8px',
                                                borderRadius: '999px',
                                                backgroundColor: isInProgress(b.status) ? '#FFF9E6' : '#F5F5F5',
                                                color: '#1D1D1B',
                                            }}
                                        >
                                            {broadcastStatusLabel(b.status)}
                                        </span>
                                    </div>

                                    <div style={{ marginTop: '10px' }}>
                                        <div
                                            style={{
                                                height: '6px',
                                                borderRadius: '999px',
                                                backgroundColor: '#EBE8E0',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: `${pct}%`,
                                                    height: '100%',
                                                    backgroundColor:
                                                        b.error_count > 0 && !isInProgress(b.status)
                                                            ? '#FFB74D'
                                                            : '#1B5E20',
                                                    transition: 'width 0.3s ease',
                                                }}
                                            />
                                        </div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                marginTop: '6px',
                                                fontSize: '11px',
                                                color: '#6B6B69',
                                            }}
                                        >
                                            <span>
                                                {b.sent_count} отправлено · {b.error_count} ошибок ·{' '}
                                                {b.total_recipients} всего
                                            </span>
                                            <span>{pct}%</span>
                                        </div>
                                    </div>
                                </button>

                                {expanded ? (
                                    <div
                                        style={{
                                            padding: '0 14px 12px',
                                            borderTop: '1px solid #F0EDE6',
                                            fontSize: '13px',
                                            color: '#1D1D1B',
                                            lineHeight: 1.5,
                                        }}
                                    >
                                        <p style={{ margin: '10px 0 6px', whiteSpace: 'pre-wrap' }}>{b.message}</p>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#6B6B69' }}>
                                            ID: {b.id}
                                            {b.make_triggered_at
                                                ? ` · Make: ${formatDate(b.make_triggered_at)}`
                                                : ''}
                                            {b.completed_at ? ` · завершена ${formatDate(b.completed_at)}` : ''}
                                        </p>
                                    </div>
                                ) : null}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
