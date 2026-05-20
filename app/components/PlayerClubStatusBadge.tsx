import type { CSSProperties } from 'react'
import {
    playerClubStatusChipStyle,
    playerClubStatusLabelPublic,
    resolvePlayerClubStatus,
} from '@/lib/playerClubStatus'

type Props = {
    status?: unknown
    compact?: boolean
    style?: CSSProperties
}

/** Бейдж статуса в клубе для публичного и личного профиля. */
export function PlayerClubStatusBadge({ status, compact = false, style }: Props) {
    const resolved = resolvePlayerClubStatus({ status: status ?? 'standard' })
    const chip = playerClubStatusChipStyle(resolved)

    return (
        <span
            style={{
                display: 'inline-block',
                padding: compact ? '3px 8px' : '4px 10px',
                borderRadius: '999px',
                fontSize: compact ? '11px' : '12px',
                fontWeight: 700,
                lineHeight: 1.2,
                flexShrink: 0,
                ...chip,
                ...style,
            }}
        >
            {playerClubStatusLabelPublic(resolved)}
        </span>
    )
}
