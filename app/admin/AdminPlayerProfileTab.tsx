'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import BrandStarIcon from '../components/BrandStarIcon'
import {
    ADMIN_PLAYER_FIELD_LABELS,
    formatAdminPlayerFieldValue,
    formatAdminPlayerRegistrationDate,
    formatAdminPlayerTelegramName,
    getAdminPlayerFooterEntries,
    extractPlayerStatsSummary,
    playerClubStatusChipStyle,
    playerClubStatusLabel,
    resolvePlayerClubStatus,
    type AdminPlayerDetailResponse,
} from '@/lib/admin/adminPlayerDetail'
import { formatPointsRu } from '@/lib/ruCountPhrases'
import { displayPublicNickname } from '@/lib/takoff'
import type { AppRole } from '@/lib/admin/appRole'

type Props = {
    detail: AdminPlayerDetailResponse
    userId: number
}

const statCell: CSSProperties = {
    flex: '1 1 0',
    minWidth: 0,
    backgroundColor: '#FAFAF8',
    borderRadius: '10px',
    border: '1px solid #EBE8E0',
    padding: '10px 8px',
    textAlign: 'center',
}

function StatBlock({ label, value }: { label: string; value: string }) {
    return (
        <div style={statCell}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#1D1D1B', lineHeight: 1.15 }}>
                {value}
            </div>
            <div style={{ fontSize: '11px', color: '#6B6B69', marginTop: '4px', fontWeight: 600 }}>
                {label}
            </div>
        </div>
    )
}

function FooterDataRow({ label, value }: { label: string; value: string }) {
    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '8px 0',
                borderBottom: '1px solid #F0EDE6',
                fontSize: '13px',
            }}
        >
            <span style={{ color: '#6B6B69', flexShrink: 0 }}>{label}</span>
            <span style={{ color: '#1D1D1B', textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
        </div>
    )
}

export function AdminPlayerProfileTab({ detail, userId }: Props) {
    const u = detail.user
    const isActive = u.is_active !== false
    const takoff = u.takoff === true
    const inactiveMuted = !isActive

    const nickname = displayPublicNickname(
        typeof u.nickname === 'string' ? u.nickname : null,
        takoff
    )
    const tgName = formatAdminPlayerTelegramName(u)
    const userpic = !takoff && typeof u.userpic === 'string' ? u.userpic.trim() : ''
    const clubStatus = resolvePlayerClubStatus(u)
    const statusChip = playerClubStatusChipStyle(clubStatus)
    const appRole = typeof u.app_role === 'string' ? (u.app_role as AppRole) : 'user'
    const showAppRole = appRole === 'admin' || appRole === 'root'

    const stats = extractPlayerStatsSummary(detail)
    const footerEntries = getAdminPlayerFooterEntries(detail)

    const regDate = formatAdminPlayerRegistrationDate(u.created_at)
    const userIdLabel = u.id != null ? String(u.id) : String(userId)

    return (
        <div>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div
                    style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        backgroundColor: '#FFDF00',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '26px',
                        color: inactiveMuted ? '#9E9E9C' : '#1D1D1B',
                        filter: inactiveMuted ? 'grayscale(1)' : undefined,
                        opacity: inactiveMuted ? 0.75 : 1,
                    }}
                >
                    {userpic ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={userpic}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                    ) : (
                        nickname.charAt(0).toUpperCase()
                    )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <div
                            title={isActive ? 'Активный аккаунт' : 'Неактивный аккаунт'}
                            style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                backgroundColor: isActive ? '#2E7D32' : '#BDBDBD',
                                flexShrink: 0,
                            }}
                        />
                        <div
                            style={{
                                fontSize: '22px',
                                fontWeight: 700,
                                color: inactiveMuted ? '#9E9E9C' : '#1D1D1B',
                                lineHeight: 1.2,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {nickname}
                        </div>
                    </div>

                    <div
                        style={{
                            fontSize: '12px',
                            color: '#6B6B69',
                            marginBottom: '4px',
                            lineHeight: 1.4,
                        }}
                    >
                        id {userIdLabel}
                        {regDate !== '—' ? ` · с ${regDate}` : ''}
                    </div>

                    {tgName ? (
                        <div style={{ fontSize: '12px', color: inactiveMuted ? '#9E9E9C' : '#6B6B69' }}>
                            {tgName}
                        </div>
                    ) : null}
                </div>
            </div>

            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    alignItems: 'center',
                    marginBottom: '14px',
                }}
            >
                <span
                    style={{
                        display: 'inline-block',
                        padding: '5px 12px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: 700,
                        ...statusChip,
                    }}
                >
                    {playerClubStatusLabel(clubStatus)}
                </span>
                {showAppRole ? (
                    <span
                        style={{
                            display: 'inline-block',
                            padding: '5px 12px',
                            borderRadius: '999px',
                            fontSize: '12px',
                            fontWeight: 700,
                            backgroundColor: '#FFDF00',
                            color: '#1D1D1B',
                        }}
                    >
                        {appRole === 'root' ? 'Root' : 'Admin'}
                    </span>
                ) : null}
            </div>

            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '16px',
                    fontSize: '28px',
                    fontWeight: 700,
                    color: inactiveMuted ? '#9E9E9C' : '#1D1D1B',
                    lineHeight: 1.1,
                }}
            >
                <BrandStarIcon size={22} />
                <span>
                    {stats.points != null ? formatPointsRu(Math.round(stats.points)) : '—'}
                </span>
            </div>

            <div
                style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '16px',
                }}
            >
                <StatBlock label="Место" value={stats.place != null ? `#${stats.place}` : '—'} />
                <StatBlock label="Игр" value={stats.games != null ? String(stats.games) : '—'} />
                <StatBlock label="Побед" value={stats.wins != null ? String(stats.wins) : '—'} />
                <StatBlock
                    label="% побед"
                    value={stats.winRate != null ? `${stats.winRate}%` : '—'}
                />
            </div>

            <div
                style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #EBE8E0',
                    backgroundColor: '#FAFAF8',
                    marginBottom: '20px',
                }}
            >
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1D1D1B', marginBottom: '10px' }}>
                    Реферальная программа
                </div>
                <div style={{ fontSize: '13px', color: '#1D1D1B', marginBottom: '6px' }}>
                    Приглашено: <strong>{detail.invited_count}</strong>
                </div>
                {detail.referral_link ? (
                    <div
                        style={{
                            fontSize: '12px',
                            color: '#6B6B69',
                            wordBreak: 'break-all',
                            lineHeight: 1.45,
                            marginBottom: '8px',
                        }}
                    >
                        {detail.referral_link}
                    </div>
                ) : (
                    <div style={{ fontSize: '12px', color: '#6B6B69', marginBottom: '8px' }}>
                        Код: {typeof u.referral_code === 'string' && u.referral_code ? u.referral_code : '—'}
                    </div>
                )}
                <div style={{ fontSize: '13px', color: '#1D1D1B' }}>
                    Пригласил:{' '}
                    {detail.inviter ? (
                        <Link
                            href={`/player/${detail.inviter.id}`}
                            style={{ color: '#1B5E20', fontWeight: 600 }}
                        >
                            {detail.inviter.display_name}
                        </Link>
                    ) : (
                        <span style={{ color: '#6B6B69' }}>—</span>
                    )}
                </div>
            </div>

            {footerEntries.length > 0 ? (
                <div>
                    <div
                        style={{
                            fontSize: '13px',
                            fontWeight: 700,
                            color: '#6B6B69',
                            marginBottom: '8px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                        }}
                    >
                        Прочие данные
                    </div>
                    {footerEntries.map(({ key, value }) => (
                        <FooterDataRow
                            key={key}
                            label={ADMIN_PLAYER_FIELD_LABELS[key.replace(/^(hall|elo_ratings)\./, '')] ?? key}
                            value={formatAdminPlayerFieldValue(key, value)}
                        />
                    ))}
                </div>
            ) : null}

            <div style={{ marginTop: '16px' }}>
                <Link href={`/player/${userId}`} style={{ fontSize: '14px', color: '#1B5E20', fontWeight: 600 }}>
                    Публичная страница →
                </Link>
            </div>
        </div>
    )
}
