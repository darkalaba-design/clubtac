'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { CSSProperties } from 'react'
import { adminFetch } from '@/lib/admin/adminFetch'
import {
    ADMIN_PLAYER_FIELD_LABELS,
    formatAdminPlayerFieldValue,
    walletTransactionTypeLabel,
    type AdminPlayerDetailResponse,
} from '@/lib/admin/adminPlayerDetail'
import { formatEventCardDayMonthAndTime, paymentStatusLabelRu } from '@/lib/admin/eventDisplay'
import { displayPublicNickname } from '@/lib/takoff'

type PlayerModalTab = 'chat' | 'profile' | 'finance'

type Props = {
    userId: number | null
    previewName?: string
    onClose: () => void
}

const fieldLabel: CSSProperties = {
    fontSize: '12px',
    fontWeight: 600,
    color: '#6B6B69',
    marginBottom: '2px',
}

function DataRow({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div style={{ marginBottom: '10px' }}>
            <div style={fieldLabel}>{label}</div>
            <div style={{ fontSize: '14px', color: '#1D1D1B', lineHeight: 1.45, wordBreak: 'break-word' }}>
                {value}
            </div>
        </div>
    )
}

function SectionTitle({ children }: { children: ReactNode }) {
    return (
        <h3
            style={{
                margin: '16px 0 10px',
                fontSize: '14px',
                fontWeight: 700,
                color: '#1D1D1B',
            }}
        >
            {children}
        </h3>
    )
}

function formatMoney(n: number): string {
    if (!Number.isFinite(n)) return '—'
    const rounded = Math.round(n * 100) / 100
    const sign = rounded > 0 ? '+' : ''
    return `${sign}${rounded.toLocaleString('ru-RU')} ₽`
}

function playerHeaderName(detail: AdminPlayerDetailResponse | null, previewName?: string): string {
    if (!detail) return previewName?.trim() || 'Игрок'
    const u = detail.user
    if (u.takoff === true) return displayPublicNickname(null, true)
    const nick = typeof u.nickname === 'string' ? u.nickname.trim() : ''
    if (nick) return nick
    const first = typeof u.first_name === 'string' ? u.first_name : ''
    const last = typeof u.last_name === 'string' ? u.last_name : ''
    const name = [first, last].filter(Boolean).join(' ').trim()
    return name || previewName?.trim() || `Игрок #${String(u.id ?? '')}`
}

export function AdminPlayerModal({ userId, previewName, onClose }: Props) {
    const [tab, setTab] = useState<PlayerModalTab>('profile')
    const [loading, setLoading] = useState(false)
    const [err, setErr] = useState<string | null>(null)
    const [detail, setDetail] = useState<AdminPlayerDetailResponse | null>(null)

    const load = useCallback(async (id: number) => {
        setLoading(true)
        setErr(null)
        try {
            const res = await adminFetch(`/api/admin/players/${id}`)
            const j = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(typeof j.error === 'string' ? j.error : res.statusText)
            }
            setDetail(j as AdminPlayerDetailResponse)
        } catch (e) {
            setDetail(null)
            setErr(e instanceof Error ? e.message : 'Не удалось загрузить игрока')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (userId == null) {
            setDetail(null)
            setErr(null)
            setTab('profile')
            return
        }
        setTab('profile')
        void load(userId)
    }, [userId, load])

    if (userId == null) return null

    const tabBtn = (key: PlayerModalTab, label: string) => (
        <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            style={{
                flex: 1,
                padding: '10px 8px',
                border: 'none',
                borderBottom: tab === key ? '3px solid #FFDF00' : '3px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
                fontWeight: tab === key ? 700 : 500,
                fontSize: '14px',
                color: tab === key ? '#1D1D1B' : '#6B6B69',
            }}
        >
            {label}
        </button>
    )

    const headerSubtitle = detail
        ? [
              `id ${String(detail.user.id ?? userId)}`,
              detail.user.telegram_id != null ? `tg ${String(detail.user.telegram_id)}` : null,
              detail.elo_leaderboard?.rating != null
                  ? `⭐ ${Math.round(Number(detail.elo_leaderboard.rating))}`
                  : null,
          ]
              .filter(Boolean)
              .join(' · ')
        : loading
          ? 'Загрузка…'
          : null

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Карточка игрока"
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1200,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#FFFFFF',
                paddingTop: 'env(safe-area-inset-top, 0px)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
        >
            <div
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    width: '100%',
                    maxWidth: 'var(--app-max-width, 850px)',
                    marginLeft: 'auto',
                    marginRight: 'auto',
                    backgroundColor: '#FFFFFF',
                }}
            >
                <div
                    style={{
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '10px',
                        padding: '12px 14px',
                        borderBottom: '1px solid #EBE8E0',
                    }}
                >
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                            style={{
                                fontWeight: 700,
                                fontSize: '17px',
                                color: '#1D1D1B',
                                lineHeight: 1.25,
                                marginBottom: headerSubtitle ? '4px' : 0,
                            }}
                        >
                            {playerHeaderName(detail, previewName)}
                        </div>
                        {headerSubtitle ? (
                            <div style={{ fontSize: '13px', color: '#6B6B69', fontWeight: 500 }}>
                                {headerSubtitle}
                            </div>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            border: 'none',
                            background: '#F5F5F5',
                            borderRadius: '8px',
                            width: '36px',
                            height: '36px',
                            cursor: 'pointer',
                            fontSize: '20px',
                            lineHeight: 1,
                            flexShrink: 0,
                        }}
                        aria-label="Закрыть"
                    >
                        ×
                    </button>
                </div>

                <div
                    style={{
                        flexShrink: 0,
                        display: 'flex',
                        borderBottom: '1px solid #EBE8E0',
                    }}
                >
                    {tabBtn('chat', 'Чат')}
                    {tabBtn('profile', 'Анкета')}
                    {tabBtn('finance', 'Финансы')}
                </div>

                <div
                    style={{
                        flex: 1,
                        minHeight: 0,
                        overflowY: 'auto',
                        WebkitOverflowScrolling: 'touch',
                    }}
                >
                    <div style={{ padding: '14px 16px 24px' }}>
                        {loading && !detail ? (
                            <p style={{ margin: 0 }}>Загрузка…</p>
                        ) : err && !detail ? (
                            <div>
                                <p style={{ margin: '0 0 12px', color: '#B71C1C' }}>{err}</p>
                                <button
                                    type="button"
                                    onClick={() => void load(userId)}
                                    style={{
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        border: '1px solid #1D1D1B',
                                        background: '#fff',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                    }}
                                >
                                    Повторить
                                </button>
                            </div>
                        ) : detail ? (
                            <>
                                {err ? (
                                    <p style={{ margin: '0 0 12px', color: '#B71C1C', fontSize: '13px' }}>{err}</p>
                                ) : null}

                                {tab === 'chat' ? (
                                    <div>
                                        <SectionTitle>Telegram</SectionTitle>
                                        <DataRow
                                            label="Telegram ID"
                                            value={formatAdminPlayerFieldValue(
                                                'telegram_id',
                                                detail.user.telegram_id
                                            )}
                                        />
                                        <DataRow
                                            label="Username"
                                            value={
                                                detail.telegram_links.username_url ? (
                                                    <a
                                                        href={detail.telegram_links.username_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ color: '#1B5E20', fontWeight: 600 }}
                                                    >
                                                        @
                                                        {String(detail.user.username ?? '').replace(/^@/, '')}
                                                    </a>
                                                ) : (
                                                    '—'
                                                )
                                            }
                                        />
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                                            {detail.telegram_links.username_url ? (
                                                <a
                                                    href={detail.telegram_links.username_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{
                                                        display: 'block',
                                                        textAlign: 'center',
                                                        padding: '11px',
                                                        borderRadius: '8px',
                                                        backgroundColor: '#1B5E20',
                                                        color: '#fff',
                                                        fontWeight: 600,
                                                        textDecoration: 'none',
                                                    }}
                                                >
                                                    Открыть в Telegram
                                                </a>
                                            ) : null}
                                            {detail.telegram_links.tg_user_url ? (
                                                <a
                                                    href={detail.telegram_links.tg_user_url}
                                                    style={{
                                                        display: 'block',
                                                        textAlign: 'center',
                                                        padding: '11px',
                                                        borderRadius: '8px',
                                                        border: '1px solid #EBE8E0',
                                                        color: '#1D1D1B',
                                                        fontWeight: 600,
                                                        textDecoration: 'none',
                                                    }}
                                                >
                                                    Ссылка tg://user
                                                </a>
                                            ) : null}
                                            {!detail.telegram_links.username_url &&
                                            !detail.telegram_links.tg_user_url ? (
                                                <p style={{ margin: 0, fontSize: '13px', color: '#6B6B69' }}>
                                                    Нет username и Telegram ID для ссылки.
                                                </p>
                                            ) : null}
                                        </div>

                                        {Object.keys(detail.chat_fields).length > 0 ? (
                                            <>
                                                <SectionTitle>Данные чата в БД</SectionTitle>
                                                {Object.entries(detail.chat_fields).map(([key, value]) => (
                                                    <DataRow
                                                        key={key}
                                                        label={ADMIN_PLAYER_FIELD_LABELS[key] ?? key}
                                                        value={formatAdminPlayerFieldValue(key, value)}
                                                    />
                                                ))}
                                            </>
                                        ) : (
                                            <p
                                                style={{
                                                    margin: '16px 0 0',
                                                    fontSize: '13px',
                                                    color: '#6B6B69',
                                                    lineHeight: 1.45,
                                                }}
                                            >
                                                Отдельных полей чата в профиле нет — связь через Telegram выше.
                                            </p>
                                        )}
                                    </div>
                                ) : null}

                                {tab === 'profile' ? (
                                    <div>
                                        <SectionTitle>Профиль</SectionTitle>
                                        {Object.entries(detail.profile_fields).map(([key, value]) => (
                                            <DataRow
                                                key={key}
                                                label={ADMIN_PLAYER_FIELD_LABELS[key] ?? key}
                                                value={
                                                    key === 'userpic' &&
                                                    typeof value === 'string' &&
                                                    value.trim() ? (
                                                        <a
                                                            href={value.trim()}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{ color: '#1B5E20', wordBreak: 'break-all' }}
                                                        >
                                                            {value.trim()}
                                                        </a>
                                                    ) : key === 'referred_by_user_id' && detail.inviter ? (
                                                        `${formatAdminPlayerFieldValue(key, value)} (${detail.inviter.display_name})`
                                                    ) : (
                                                        formatAdminPlayerFieldValue(key, value)
                                                    )
                                                }
                                            />
                                        ))}

                                        <SectionTitle>Рейтинг Elo</SectionTitle>
                                        {detail.elo_leaderboard || detail.elo_rating ? (
                                            <>
                                                {detail.elo_leaderboard ? (
                                                    <>
                                                        <DataRow
                                                            label="Рейтинг"
                                                            value={formatAdminPlayerFieldValue(
                                                                'rating',
                                                                detail.elo_leaderboard.rating
                                                            )}
                                                        />
                                                        <DataRow
                                                            label="Место"
                                                            value={formatAdminPlayerFieldValue(
                                                                'place',
                                                                detail.elo_leaderboard.place
                                                            )}
                                                        />
                                                        <DataRow
                                                            label="Игр (Elo)"
                                                            value={formatAdminPlayerFieldValue(
                                                                'games_played',
                                                                detail.elo_leaderboard.games_played
                                                            )}
                                                        />
                                                    </>
                                                ) : null}
                                                {detail.elo_rating ? (
                                                    <DataRow
                                                        label="Обновление рейтинга"
                                                        value={formatAdminPlayerFieldValue(
                                                            'updated_at',
                                                            detail.elo_rating.updated_at
                                                        )}
                                                    />
                                                ) : null}
                                            </>
                                        ) : (
                                            <p style={{ margin: 0, fontSize: '13px', color: '#6B6B69' }}>
                                                Нет данных в Elo.
                                            </p>
                                        )}

                                        <SectionTitle>Зал славы</SectionTitle>
                                        {detail.hall_of_fame ? (
                                            Object.entries(detail.hall_of_fame)
                                                .filter(([k]) => k !== 'user_id')
                                                .map(([key, value]) => (
                                                    <DataRow
                                                        key={key}
                                                        label={key}
                                                        value={formatAdminPlayerFieldValue(key, value)}
                                                    />
                                                ))
                                        ) : (
                                            <p style={{ margin: 0, fontSize: '13px', color: '#6B6B69' }}>
                                                Нет строки в hall of fame.
                                            </p>
                                        )}

                                        <SectionTitle>Рефералы</SectionTitle>
                                        <DataRow label="Приглашено игроков" value={String(detail.invited_count)} />
                                        <DataRow
                                            label="Реферальная ссылка"
                                            value={
                                                detail.referral_link ? (
                                                    <span style={{ wordBreak: 'break-all' }}>{detail.referral_link}</span>
                                                ) : (
                                                    '—'
                                                )
                                            }
                                        />
                                        {detail.inviter ? (
                                            <DataRow
                                                label="Кто пригласил"
                                                value={
                                                    <Link
                                                        href={`/player/${detail.inviter.id}`}
                                                        style={{ color: '#1B5E20', fontWeight: 600 }}
                                                    >
                                                        {detail.inviter.display_name}
                                                    </Link>
                                                }
                                            />
                                        ) : (
                                            <DataRow label="Кто пригласил" value="—" />
                                        )}

                                        {Object.keys(detail.extra_fields).length > 0 ? (
                                            <>
                                                <SectionTitle>Дополнительные поля БД</SectionTitle>
                                                {Object.entries(detail.extra_fields).map(([key, value]) => (
                                                    <DataRow
                                                        key={key}
                                                        label={key}
                                                        value={formatAdminPlayerFieldValue(key, value)}
                                                    />
                                                ))}
                                            </>
                                        ) : null}

                                        <div style={{ marginTop: '16px' }}>
                                            <Link
                                                href={`/player/${userId}`}
                                                style={{
                                                    fontSize: '14px',
                                                    color: '#1B5E20',
                                                    fontWeight: 600,
                                                }}
                                            >
                                                Публичная страница игрока →
                                            </Link>
                                        </div>
                                    </div>
                                ) : null}

                                {tab === 'finance' ? (
                                    <div>
                                        <SectionTitle>Кошелёк</SectionTitle>
                                        <DataRow
                                            label="Баланс (сумма транзакций)"
                                            value={
                                                <span
                                                    style={{
                                                        fontWeight: 700,
                                                        fontSize: '18px',
                                                        color:
                                                            detail.wallet_balance >= 0 ? '#1B5E20' : '#B71C1C',
                                                    }}
                                                >
                                                    {formatMoney(detail.wallet_balance)}
                                                </span>
                                            }
                                        />

                                        <SectionTitle>Транзакции</SectionTitle>
                                        {detail.wallet_transactions.length === 0 ? (
                                            <p style={{ margin: 0, fontSize: '13px', color: '#6B6B69' }}>
                                                Транзакций нет.
                                            </p>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {detail.wallet_transactions.map((tx, i) => (
                                                    <div
                                                        key={tx.id ?? `${tx.created_at}-${i}`}
                                                        style={{
                                                            padding: '10px 12px',
                                                            borderRadius: '8px',
                                                            border: '1px solid #EBE8E0',
                                                            backgroundColor: '#FAFAF8',
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                gap: '8px',
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            <span>{walletTransactionTypeLabel(tx.type)}</span>
                                                            <span
                                                                style={{
                                                                    color:
                                                                        Number(tx.amount) >= 0
                                                                            ? '#1B5E20'
                                                                            : '#B71C1C',
                                                                }}
                                                            >
                                                                {formatMoney(Number(tx.amount))}
                                                            </span>
                                                        </div>
                                                        {tx.event_title ? (
                                                            <div
                                                                style={{ fontSize: '12px', color: '#6B6B69', marginTop: '4px' }}
                                                            >
                                                                {tx.event_title}
                                                            </div>
                                                        ) : null}
                                                        <div
                                                            style={{ fontSize: '11px', color: '#9E9E9C', marginTop: '4px' }}
                                                        >
                                                            {tx.created_at
                                                                ? formatAdminPlayerFieldValue('created_at', tx.created_at)
                                                                : ''}
                                                            {tx.order_id ? ` · order ${String(tx.order_id).slice(0, 8)}…` : ''}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <SectionTitle>Участие в событиях</SectionTitle>
                                        {detail.event_participations.length === 0 ? (
                                            <p style={{ margin: 0, fontSize: '13px', color: '#6B6B69' }}>
                                                Записей на события нет.
                                            </p>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {detail.event_participations.map((p) => (
                                                    <div
                                                        key={String(p.id)}
                                                        style={{
                                                            padding: '10px 12px',
                                                            borderRadius: '8px',
                                                            border: '1px solid #EBE8E0',
                                                        }}
                                                    >
                                                        <div style={{ fontWeight: 600, fontSize: '14px' }}>
                                                            {p.event_title?.trim() || `Событие ${p.event_id}`}
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: '#6B6B69', marginTop: '4px' }}>
                                                            {paymentStatusLabelRu(p.payment_status, p.price_paid)}
                                                            {p.price_paid != null && Number(p.price_paid) > 0
                                                                ? ` · ${Number(p.price_paid)} ₽`
                                                                : ''}
                                                        </div>
                                                        {p.starts_at ? (
                                                            <div
                                                                style={{ fontSize: '12px', color: '#6B6B69', marginTop: '2px' }}
                                                            >
                                                                {formatEventCardDayMonthAndTime(p.starts_at)}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : null}
                            </>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    )
}
