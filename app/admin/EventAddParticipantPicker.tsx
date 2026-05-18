'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { displayPublicNickname } from '@/lib/takoff'

export type EventAddParticipantPlayer = {
    user_id: number
    telegram_id?: number
    first_name?: string | null
    last_name?: string | null
    username?: string | null
    nickname?: string | null
    takoff?: boolean
}

type Props = {
    players: EventAddParticipantPlayer[]
    activeParticipantUserIds: number[]
    eventPrice: number | null
    busy: boolean
    onAdd: (userId: number, method: 'cash' | 'free') => void | Promise<void>
}

function playerDisplayName(p: EventAddParticipantPlayer): string {
    if (p.takoff) return displayPublicNickname(null, true)
    if (p.nickname?.trim()) return p.nickname.trim()
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
    return name || `Игрок #${p.user_id}`
}

function playerMatchesSearch(p: EventAddParticipantPlayer, rawQuery: string): boolean {
    const q = rawQuery.trim().toLowerCase()
    if (!q) return true
    const nick = (p.nickname ?? '').trim().toLowerCase()
    const uname = (p.username ?? '').trim().toLowerCase()
    const first = (p.first_name ?? '').trim().toLowerCase()
    const last = (p.last_name ?? '').trim().toLowerCase()
    const full = `${first} ${last}`.trim()
    const chunks = [
        nick,
        first,
        last,
        full,
        uname,
        uname ? `@${uname}` : '',
        String(p.user_id),
        p.telegram_id != null ? String(p.telegram_id) : '',
    ]
    return chunks.some((c) => c.length > 0 && c.includes(q))
}

export function EventAddParticipantPicker({
    players,
    activeParticipantUserIds,
    eventPrice,
    busy,
    onAdd,
}: Props) {
    const [query, setQuery] = useState('')
    const [selected, setSelected] = useState<EventAddParticipantPlayer | null>(null)
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [showPaymentPrompt, setShowPaymentPrompt] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)

    const activeSet = useMemo(() => new Set(activeParticipantUserIds), [activeParticipantUserIds])

    const availablePlayers = useMemo(
        () => players.filter((p) => !activeSet.has(p.user_id)),
        [players, activeSet]
    )

    const filteredPlayers = useMemo(() => {
        const q = query.trim()
        if (!q) return availablePlayers.slice(0, 12)
        return availablePlayers.filter((p) => playerMatchesSearch(p, q)).slice(0, 12)
    }, [availablePlayers, query])

    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) {
                setDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', onDocClick)
        return () => document.removeEventListener('mousedown', onDocClick)
    }, [])

    const resetSelection = () => {
        setSelected(null)
        setQuery('')
        setDropdownOpen(false)
        setShowPaymentPrompt(false)
    }

    const selectPlayer = (p: EventAddParticipantPlayer) => {
        setSelected(p)
        setQuery(playerDisplayName(p))
        setDropdownOpen(false)
        setShowPaymentPrompt(true)
    }

    const confirmAdd = async (method: 'cash' | 'free') => {
        if (!selected) return
        await onAdd(selected.user_id, method)
        resetSelection()
    }

    const priceLabel =
        eventPrice != null && eventPrice > 0 ? `${eventPrice} ₽` : 'бесплатно'

    return (
        <div ref={rootRef} style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#1D1D1B', marginBottom: '6px' }}>
                Добавить участника
            </div>
            <input
                type="search"
                value={query}
                disabled={busy}
                onChange={(e) => {
                    const v = e.target.value
                    setQuery(v)
                    setSelected(null)
                    setShowPaymentPrompt(false)
                    setDropdownOpen(true)
                }}
                onFocus={() => setDropdownOpen(true)}
                placeholder="Ник, имя, @username, id…"
                autoComplete="off"
                style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #EBE8E0',
                    boxSizing: 'border-box',
                    fontSize: '15px',
                    backgroundColor: busy ? '#F5F5F5' : '#FFFFFF',
                }}
            />
            {dropdownOpen && !showPaymentPrompt && filteredPlayers.length > 0 ? (
                <ul
                    style={{
                        margin: '4px 0 0',
                        padding: 0,
                        listStyle: 'none',
                        border: '1px solid #EBE8E0',
                        borderRadius: '8px',
                        backgroundColor: '#FFFFFF',
                        maxHeight: '220px',
                        overflowY: 'auto',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    }}
                >
                    {filteredPlayers.map((p) => (
                        <li key={p.user_id}>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => selectPlayer(p)}
                                style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '10px 12px',
                                    border: 'none',
                                    borderBottom: '1px solid #F0EDE6',
                                    background: 'transparent',
                                    cursor: busy ? 'not-allowed' : 'pointer',
                                    fontSize: '14px',
                                    color: '#1D1D1B',
                                }}
                            >
                                {playerDisplayName(p)}
                                <span style={{ color: '#6B6B69', fontSize: '12px', marginLeft: '6px' }}>
                                    #{p.user_id}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}
            {dropdownOpen && !showPaymentPrompt && query.trim() && filteredPlayers.length === 0 ? (
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#6B6B69' }}>
                    {availablePlayers.length === 0
                        ? 'Все игроки уже в списке участников.'
                        : 'Никого не найдено.'}
                </p>
            ) : null}

            {showPaymentPrompt && selected ? (
                <div
                    style={{
                        marginTop: '12px',
                        paddingTop: '12px',
                        borderTop: '1px solid #EBE8E0',
                    }}
                >
                    <p style={{ margin: '0 0 10px', fontWeight: 600, color: '#1D1D1B', lineHeight: 1.45 }}>
                        Записать {playerDisplayName(selected)}?
                        <br />
                        <span style={{ fontWeight: 500, fontSize: '13px', color: '#6B6B69' }}>
                            Стоимость события: {priceLabel}
                        </span>
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => void confirmAdd('cash')}
                            style={{
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: '#1B5E20',
                                color: '#fff',
                                fontWeight: 600,
                                fontSize: '14px',
                                cursor: busy ? 'not-allowed' : 'pointer',
                                opacity: busy ? 0.65 : 1,
                            }}
                        >
                            Оплатил налом
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => void confirmAdd('free')}
                            style={{
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: '1px solid #1B5E20',
                                backgroundColor: '#fff',
                                color: '#1B5E20',
                                fontWeight: 600,
                                fontSize: '14px',
                                cursor: busy ? 'not-allowed' : 'pointer',
                                opacity: busy ? 0.65 : 1,
                            }}
                        >
                            Пускаем бесплатно
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={resetSelection}
                            style={{
                                padding: '8px',
                                border: 'none',
                                background: 'transparent',
                                color: '#6B6B69',
                                fontSize: '13px',
                                cursor: 'pointer',
                            }}
                        >
                            Отмена
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
