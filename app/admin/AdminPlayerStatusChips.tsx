'use client'

import type { CSSProperties } from 'react'
import type { AppRole } from '@/lib/admin/appRole'
import {
    playerClubStatusChipStyle,
    playerClubStatusLabelAdmin,
    resolvePlayerClubStatus,
} from '@/lib/playerClubStatus'

type Props = {
    user: Record<string, unknown>
    /** На списке «Игроки» не показываем «Гость», только Участник / Партнер. */
    hideStandardClubStatus?: boolean
    /** Чуть компактнее для строк списка. */
    compact?: boolean
}

const adminRoleChip: CSSProperties = {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 700,
    backgroundColor: '#FFDF00',
    color: '#1D1D1B',
}

const adminRoleChipDefault: CSSProperties = {
    display: 'inline-block',
    padding: '5px 12px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 700,
    backgroundColor: '#FFDF00',
    color: '#1D1D1B',
}

/** Гость / Участник / Партнер и Admin / Root — в списке игроков (только просмотр). */
export function AdminPlayerStatusChips({
    user,
    hideStandardClubStatus = false,
    compact = false,
}: Props) {
    const clubStatus = resolvePlayerClubStatus(user)
    const statusChip = playerClubStatusChipStyle(clubStatus)
    const appRole = typeof user.app_role === 'string' ? (user.app_role as AppRole) : 'user'
    const showAppRole = appRole === 'admin' || appRole === 'root'
    const showClubStatus = !hideStandardClubStatus || clubStatus !== 'standard'

    if (!showClubStatus && !showAppRole) return null

    const chipPad = compact ? '3px 8px' : '5px 12px'
    const chipFont = compact ? '11px' : '12px'

    return (
        <div
            style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: compact ? '4px' : '8px',
                alignItems: 'center',
            }}
        >
            {showClubStatus ? (
                <span
                    style={{
                        display: 'inline-block',
                        padding: chipPad,
                        borderRadius: '999px',
                        fontSize: chipFont,
                        fontWeight: 700,
                        ...statusChip,
                    }}
                >
                    {playerClubStatusLabelAdmin(clubStatus)}
                </span>
            ) : null}
            {showAppRole ? (
                <span style={compact ? adminRoleChip : adminRoleChipDefault}>
                    {appRole === 'root' ? 'Root' : 'Admin'}
                </span>
            ) : null}
        </div>
    )
}
