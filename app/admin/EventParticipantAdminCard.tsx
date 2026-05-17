'use client'

import Link from 'next/link'
import {
    formatEventCardDayMonthAndTime,
    paymentStatusBadgeStyle,
    paymentStatusLabelRu,
} from '@/lib/admin/eventDisplay'
import { formatParticipantDisplay, participantAvatarInitial } from '@/lib/admin/formatParticipantDisplay'

export type EventParticipantAdminCardProps = {
    participant: {
        id: string | number
        user_id: number
        payment_status: string
        price_paid: number | null
        paylink: string | null
        created_at: string | null
        first_name: string | null
        last_name: string | null
        username: string | null
        nickname: string | null
        userpic: string | null
        takoff: boolean
    }
    participantBusy: boolean
    isPending: boolean
    showAdmitPrompt: boolean
    showExcludePrompt: boolean
    refundAmount: number
    onExcludeClick: () => void
    onAdmitClick: () => void
    onCancelAdmit: () => void
    onCancelExclude: () => void
    onConfirmExclude: () => void
    onAdmitCash: () => void
    onAdmitFree: () => void
}

export function EventParticipantAdminCard({
    participant: p,
    participantBusy,
    isPending,
    showAdmitPrompt,
    showExcludePrompt,
    refundAmount,
    onExcludeClick,
    onAdmitClick,
    onCancelAdmit,
    onCancelExclude,
    onConfirmExclude,
    onAdmitCash,
    onAdmitFree,
}: EventParticipantAdminCardProps) {
    const displayName = formatParticipantDisplay(p)
    const avatarUrl = !p.takoff && p.userpic?.trim() ? p.userpic.trim() : null
    const statusBadge = paymentStatusBadgeStyle(p.payment_status)
    const metaParts: string[] = []
    if (p.created_at) {
        metaParts.push(formatEventCardDayMonthAndTime(p.created_at))
    }
    if (p.price_paid != null && Number.isFinite(Number(p.price_paid))) {
        metaParts.push(`${Number(p.price_paid)} ₽`)
    }

    return (
        <li
            style={{
                border: '1px solid #EBE8E0',
                borderRadius: '12px',
                padding: '12px 14px',
                fontSize: '14px',
                backgroundColor: '#FAFAF8',
            }}
        >
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <Link
                    href={`/player/${p.user_id}`}
                    style={{ flexShrink: 0, textDecoration: 'none' }}
                    title={displayName}
                >
                    <div
                        style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            backgroundColor: '#FFDF00',
                            border: '2px solid #fff',
                            boxShadow: '0 1px 4px rgba(29,29,27,0.12)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '16px',
                            color: '#1D1D1B',
                        }}
                    >
                        {avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={avatarUrl}
                                alt=""
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    display: 'block',
                                }}
                            />
                        ) : (
                            participantAvatarInitial(p)
                        )}
                    </div>
                </Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px',
                            justifyContent: 'space-between',
                        }}
                    >
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    alignItems: 'center',
                                    gap: '6px',
                                    minWidth: 0,
                                }}
                            >
                                <Link
                                    href={`/player/${p.user_id}`}
                                    title={displayName}
                                    style={{
                                        fontWeight: 600,
                                        color: '#1D1D1B',
                                        textDecoration: 'none',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        minWidth: 0,
                                        maxWidth: '100%',
                                        display: 'block',
                                    }}
                                >
                                    {displayName}
                                </Link>
                                <span
                                    style={{
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        padding: '2px 8px',
                                        borderRadius: '999px',
                                        flexShrink: 0,
                                        backgroundColor: statusBadge.backgroundColor,
                                        color: statusBadge.color,
                                    }}
                                >
                                    {paymentStatusLabelRu(p.payment_status)}
                                </span>
                            </div>
                            {metaParts.length > 0 ? (
                                <div
                                    style={{
                                        fontSize: '12px',
                                        color: '#6B6B69',
                                        marginTop: '4px',
                                        lineHeight: 1.35,
                                    }}
                                >
                                    {metaParts.join(' · ')}
                                </div>
                            ) : null}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            <button
                                type="button"
                                disabled={participantBusy}
                                onClick={onExcludeClick}
                                style={{
                                    padding: '6px 10px',
                                    borderRadius: '8px',
                                    border: '1px solid #B71C1C',
                                    backgroundColor: '#fff',
                                    color: '#B71C1C',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: participantBusy ? 'not-allowed' : 'pointer',
                                    opacity: participantBusy ? 0.65 : 1,
                                }}
                            >
                                Исключить
                            </button>
                            {isPending ? (
                                <button
                                    type="button"
                                    disabled={participantBusy}
                                    onClick={onAdmitClick}
                                    style={{
                                        padding: '6px 10px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        backgroundColor: '#FFDF00',
                                        color: '#1D1D1B',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        cursor: participantBusy ? 'not-allowed' : 'pointer',
                                        opacity: participantBusy ? 0.65 : 1,
                                    }}
                                >
                                    Добавить
                                </button>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
            {p.paylink?.trim() ? (
                <a
                    href={p.paylink.trim()}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                        fontSize: '13px',
                        color: '#1565C0',
                        marginTop: '8px',
                        marginLeft: '56px',
                        display: 'inline-block',
                    }}
                >
                    Ссылка на оплату
                </a>
            ) : null}
            {showExcludePrompt ? (
                <div
                    style={{
                        marginTop: '12px',
                        paddingTop: '12px',
                        borderTop: '1px solid #EBE8E0',
                    }}
                >
                    <p
                        style={{
                            margin: '0 0 10px',
                            fontWeight: 600,
                            color: '#1D1D1B',
                            lineHeight: 1.45,
                        }}
                    >
                        Исключить игрока из события?
                        {refundAmount > 0 ? (
                            <>
                                <br />
                                <span style={{ fontWeight: 500 }}>
                                    На баланс игрока будет возвращено {refundAmount} ₽.
                                </span>
                            </>
                        ) : null}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button
                            type="button"
                            disabled={participantBusy}
                            onClick={onConfirmExclude}
                            style={{
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: '#B71C1C',
                                color: '#fff',
                                fontWeight: 600,
                                fontSize: '14px',
                                cursor: participantBusy ? 'not-allowed' : 'pointer',
                            }}
                        >
                            Исключить
                        </button>
                        <button
                            type="button"
                            disabled={participantBusy}
                            onClick={onCancelExclude}
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
            {showAdmitPrompt ? (
                <div
                    style={{
                        marginTop: '12px',
                        paddingTop: '12px',
                        borderTop: '1px solid #EBE8E0',
                    }}
                >
                    <p style={{ margin: '0 0 10px', fontWeight: 600, color: '#1D1D1B' }}>
                        Допустить игрока?
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button
                            type="button"
                            disabled={participantBusy}
                            onClick={onAdmitCash}
                            style={{
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: '#1B5E20',
                                color: '#fff',
                                fontWeight: 600,
                                fontSize: '14px',
                                cursor: participantBusy ? 'not-allowed' : 'pointer',
                            }}
                        >
                            Оплатил налом
                        </button>
                        <button
                            type="button"
                            disabled={participantBusy}
                            onClick={onAdmitFree}
                            style={{
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: '1px solid #1B5E20',
                                backgroundColor: '#fff',
                                color: '#1B5E20',
                                fontWeight: 600,
                                fontSize: '14px',
                                cursor: participantBusy ? 'not-allowed' : 'pointer',
                            }}
                        >
                            Пускаем бесплатно
                        </button>
                        <button
                            type="button"
                            disabled={participantBusy}
                            onClick={onCancelAdmit}
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
        </li>
    )
}
