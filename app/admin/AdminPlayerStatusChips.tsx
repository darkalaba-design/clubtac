'use client'

import type { CSSProperties } from 'react'
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
    /** На списке «Игроки» не показываем «Стандарт», только VIP / Partner. */
    hideStandardClubStatus?: boolean
    /** Чуть компактнее для строк списка. */
    compact?: boolean
    /** Во вкладке «Анкета» — отдельные кнопки для каждого статуса. */
    clubStatusEditable?: boolean
    clubStatusSaving?: boolean
    onClubStatusSelect?: (status: PlayerClubStatus) => void
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

function inactiveClubStatusButtonStyle(status: PlayerClubStatus): CSSProperties {
    const { color } = playerClubStatusChipStyle(status)
    return {
        backgroundColor: '#FFFFFF',
        color,
        border: `1.5px solid ${color}`,
        opacity: 0.85,
    }
}

/** VIP / Partner и Admin / Root — как во вкладке «Анкета» модалки игрока. */
export function AdminPlayerStatusChips({
    user,
    hideStandardClubStatus = false,
    compact = false,
    clubStatusEditable = false,
    clubStatusSaving = false,
    onClubStatusSelect,
}: Props) {
    const clubStatus = resolvePlayerClubStatus(user)
    const statusChip = playerClubStatusChipStyle(clubStatus)
    const appRole = typeof user.app_role === 'string' ? (user.app_role as AppRole) : 'user'
    const showAppRole = appRole === 'admin' || appRole === 'root'
    const showClubStatus = !hideStandardClubStatus || clubStatus !== 'standard'
    const showEditableClubStatuses = clubStatusEditable && !!onClubStatusSelect

    if (!showClubStatus && !showAppRole && !showEditableClubStatuses) return null

    const chipPad = compact ? '3px 8px' : '5px 12px'
    const chipFont = compact ? '11px' : '12px'
    const chipBase: CSSProperties = {
        display: 'inline-block',
        padding: chipPad,
        borderRadius: '999px',
        fontSize: chipFont,
        fontWeight: 700,
    }

    return (
        <div
            style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: compact ? '4px' : '8px',
                alignItems: 'center',
            }}
        >
            {showEditableClubStatuses
                ? PLAYER_CLUB_STATUSES.map((status) => {
                      const active = clubStatus === status
                      const filled = playerClubStatusChipStyle(status)
                      const outline = inactiveClubStatusButtonStyle(status)
                      return (
                          <button
                              key={status}
                              type="button"
                              disabled={clubStatusSaving}
                              title={
                                  active
                                      ? 'Текущий статус'
                                      : `Выставить: ${playerClubStatusLabelAdmin(status)}`
                              }
                              onClick={() => {
                                  if (!active) onClubStatusSelect(status)
                              }}
                              style={{
                                  ...chipBase,
                                  border: active ? 'none' : outline.border,
                                  cursor: clubStatusSaving ? 'wait' : active ? 'default' : 'pointer',
                                  opacity: clubStatusSaving ? 0.65 : active ? 1 : outline.opacity,
                                  backgroundColor: active ? filled.backgroundColor : outline.backgroundColor,
                                  color: active ? filled.color : outline.color,
                              }}
                          >
                              {playerClubStatusLabelAdmin(status)}
                          </button>
                      )
                  })
                : showClubStatus ? (
                      <span style={{ ...chipBase, ...statusChip }}>{playerClubStatusLabelAdmin(clubStatus)}</span>
                  ) : null}
            {showAppRole ? (
                <span style={compact ? adminRoleChip : adminRoleChipDefault}>
                    {appRole === 'root' ? 'Root' : 'Admin'}
                </span>
            ) : null}
        </div>
    )
}
