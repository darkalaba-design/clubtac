'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { displayPublicNickname } from '@/lib/takoff'

export type AdminPlayerOption = {
    user_id: number
    telegram_id?: number
    first_name?: string | null
    last_name?: string | null
    username?: string | null
    nickname?: string | null
    takoff?: boolean
}

type Props = {
    label: string
    players: AdminPlayerOption[]
    excludeUserIds?: number[]
    value: AdminPlayerOption | null
    onChange: (player: AdminPlayerOption | null) => void
    disabled?: boolean
}

const LABEL_WIDTH = 68

export function adminPlayerDisplayName(p: AdminPlayerOption): string {
    if (p.takoff) return displayPublicNickname(null, true)
    if (p.nickname?.trim()) return p.nickname.trim()
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
    return name || `Игрок #${p.user_id}`
}

function playerMatchesSearch(p: AdminPlayerOption, rawQuery: string): boolean {
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

export function AdminPlayerSearchField({
    label,
    players,
    excludeUserIds = [],
    value,
    onChange,
    disabled = false,
}: Props) {
    const [query, setQuery] = useState('')
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)

    const excludeSet = useMemo(() => new Set(excludeUserIds), [excludeUserIds])

    const availablePlayers = useMemo(
        () => players.filter((p) => !excludeSet.has(p.user_id)),
        [players, excludeSet]
    )

    const filteredPlayers = useMemo(() => {
        const q = query.trim()
        if (!q) return availablePlayers.slice(0, 12)
        return availablePlayers.filter((p) => playerMatchesSearch(p, q)).slice(0, 12)
    }, [availablePlayers, query])

    useEffect(() => {
        if (value) {
            setQuery(adminPlayerDisplayName(value))
        }
    }, [value])

    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) {
                setDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', onDocClick)
        return () => document.removeEventListener('mousedown', onDocClick)
    }, [])

    const selectPlayer = (p: AdminPlayerOption) => {
        onChange(p)
        setQuery(adminPlayerDisplayName(p))
        setDropdownOpen(false)
    }

    const clearField = () => {
        onChange(null)
        setQuery('')
        setDropdownOpen(false)
    }

    const showClear = Boolean(value)

    return (
        <div ref={rootRef} style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                    style={{
                        flexShrink: 0,
                        width: LABEL_WIDTH,
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#1D1D1B',
                        lineHeight: 1.2,
                    }}
                >
                    {label}
                </div>
                <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                    <input
                        type="text"
                        value={query}
                        disabled={disabled}
                        onChange={(e) => {
                            const v = e.target.value
                            setQuery(v)
                            if (value && v !== adminPlayerDisplayName(value)) {
                                onChange(null)
                            }
                            setDropdownOpen(true)
                        }}
                        onFocus={() => setDropdownOpen(true)}
                        placeholder="Поиск…"
                        autoComplete="off"
                        style={{
                            width: '100%',
                            padding: showClear ? '9px 36px 9px 10px' : '9px 10px',
                            borderRadius: '8px',
                            border: '1px solid #EBE8E0',
                            boxSizing: 'border-box',
                            fontSize: '14px',
                            backgroundColor: disabled ? '#F5F5F5' : '#FFFFFF',
                        }}
                    />
                    {showClear ? (
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={clearField}
                            aria-label="Сбросить выбор"
                            style={{
                                position: 'absolute',
                                right: '4px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: '28px',
                                height: '28px',
                                padding: 0,
                                border: 'none',
                                borderRadius: '6px',
                                background: '#F5F5F5',
                                color: '#6B6B69',
                                fontSize: '18px',
                                lineHeight: 1,
                                cursor: disabled ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            ×
                        </button>
                    ) : null}
                </div>
            </div>
            {dropdownOpen && filteredPlayers.length > 0 ? (
                <ul
                    style={{
                        margin: '4px 0 0',
                        marginLeft: LABEL_WIDTH + 8,
                        padding: 0,
                        listStyle: 'none',
                        border: '1px solid #EBE8E0',
                        borderRadius: '8px',
                        backgroundColor: '#FFFFFF',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    }}
                >
                    {filteredPlayers.map((p) => (
                        <li key={p.user_id}>
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => selectPlayer(p)}
                                style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '10px 12px',
                                    border: 'none',
                                    borderBottom: '1px solid #F0EDE6',
                                    background: 'transparent',
                                    cursor: disabled ? 'not-allowed' : 'pointer',
                                    fontSize: '14px',
                                    color: '#1D1D1B',
                                }}
                            >
                                {adminPlayerDisplayName(p)}
                                <span style={{ color: '#6B6B69', fontSize: '12px', marginLeft: '6px' }}>
                                    #{p.user_id}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}
            {dropdownOpen && query.trim() && filteredPlayers.length === 0 ? (
                <p
                    style={{
                        margin: '6px 0 0',
                        marginLeft: LABEL_WIDTH + 8,
                        fontSize: '13px',
                        color: '#6B6B69',
                    }}
                >
                    Никого не найдено.
                </p>
            ) : null}
        </div>
    )
}
