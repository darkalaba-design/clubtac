'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { AppRole } from '@/lib/admin/appRole'
import {
    PLAYER_CLUB_STATUSES,
    playerClubStatusChipStyle,
    playerClubStatusLabelAdmin,
    resolvePlayerClubStatus,
    type PlayerClubStatus,
} from '@/lib/playerClubStatus'

type Props = {
    user: Record<string, unknown>
    saving?: boolean
    onSelect: (status: PlayerClubStatus) => void
}

const adminRoleChip: CSSProperties = {
    display: 'inline-block',
    padding: '5px 12px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 700,
    backgroundColor: '#FFDF00',
    color: '#1D1D1B',
}

function inactiveOptionStyle(status: PlayerClubStatus): CSSProperties {
    const { color } = playerClubStatusChipStyle(status)
    return {
        backgroundColor: '#FFFFFF',
        color,
        border: `1.5px solid ${color}`,
    }
}

/** Один бейдж статуса в шапке модалки; по клику — блок выбора, после смены сворачивается. */
export function AdminPlayerClubStatusPicker({ user, saving = false, onSelect }: Props) {
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)

    const clubStatus = resolvePlayerClubStatus(user)
    const statusChip = playerClubStatusChipStyle(clubStatus)
    const appRole = typeof user.app_role === 'string' ? (user.app_role as AppRole) : 'user'
    const showAppRole = appRole === 'admin' || appRole === 'root'

    const close = useCallback(() => setOpen(false), [])

    useEffect(() => {
        if (!open) return
        const onDocDown = (e: MouseEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) close()
        }
        document.addEventListener('mousedown', onDocDown)
        return () => document.removeEventListener('mousedown', onDocDown)
    }, [open, close])

    const pick = (status: PlayerClubStatus) => {
        close()
        if (status !== clubStatus) onSelect(status)
    }

    return (
        <div ref={rootRef}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <button
                    type="button"
                    disabled={saving}
                    title="Сменить статус в клубе"
                    onClick={() => setOpen((v) => !v)}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '5px 12px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: 700,
                        border: 'none',
                        cursor: saving ? 'wait' : 'pointer',
                        opacity: saving ? 0.65 : 1,
                        ...statusChip,
                    }}
                >
                    {playerClubStatusLabelAdmin(clubStatus)}
                    <span
                        style={{
                            fontSize: '10px',
                            lineHeight: 1,
                            opacity: 0.75,
                            transform: open ? 'rotate(180deg)' : undefined,
                            transition: 'transform 0.15s ease',
                        }}
                        aria-hidden
                    >
                        ▾
                    </span>
                </button>
                {showAppRole ? (
                    <span style={adminRoleChip}>{appRole === 'root' ? 'Root' : 'Admin'}</span>
                ) : null}
            </div>

            {open ? (
                <div
                    style={{
                        marginTop: '8px',
                        padding: '8px',
                        borderRadius: '10px',
                        border: '1px solid #EBE8E0',
                        backgroundColor: '#FAFAF8',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                    }}
                >
                    {PLAYER_CLUB_STATUSES.map((status) => {
                        const active = clubStatus === status
                        const filled = playerClubStatusChipStyle(status)
                        const outline = inactiveOptionStyle(status)
                        return (
                            <button
                                key={status}
                                type="button"
                                disabled={saving}
                                onClick={() => pick(status)}
                                style={{
                                    padding: '5px 12px',
                                    borderRadius: '999px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    border: active ? 'none' : outline.border,
                                    cursor: saving ? 'wait' : 'pointer',
                                    backgroundColor: active ? filled.backgroundColor : outline.backgroundColor,
                                    color: active ? filled.color : outline.color,
                                }}
                            >
                                {playerClubStatusLabelAdmin(status)}
                            </button>
                        )
                    })}
                </div>
            ) : null}
        </div>
    )
}
