'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { adminFetch } from '@/lib/admin/adminFetch'
import {
    adminMessageSenderLabel,
    dayKeyFromIso,
    formatAdminMessageDayLabel,
    formatAdminMessageTime,
    mergeAdminPlayerMessages,
    parseAdminPlayerMessageRow,
    type AdminMessageSender,
    type AdminPlayerMessage,
    type AdminPlayerMessagesResponse,
} from '@/lib/admin/adminPlayerMessages'

const COMPOSER_LINE_HEIGHT_PX = 20
const COMPOSER_PAD_Y = 10
const COMPOSER_PAD_X = 12
const COMPOSER_MAX_ROWS = 6
const SEND_BTN_SIZE = 40

type Props = {
    userId: number
    active: boolean
}

function ChatSendIcon({ fill }: { fill: string }) {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
                d="M18.5565 1.37114C19.8913 1.13368 21.0794 1.1909 21.9442 2.05571L22.0965 2.22172C22.8147 3.06969 22.8514 4.19194 22.6288 5.4434C22.3903 6.7836 21.805 8.53309 21.0633 10.7579L19.3475 15.9073C18.7468 17.7094 18.2815 19.1056 17.8534 20.1123C17.4681 21.0183 17.0464 21.7832 16.4344 22.2012L16.3094 22.2803C15.2998 22.8672 14.0676 22.9042 13.0301 22.3907L12.8251 22.2803C12.1446 21.8847 11.6921 21.0786 11.2811 20.1123C10.853 19.1056 10.3886 17.7093 9.78795 15.9073C9.58061 15.2852 9.5152 15.1095 9.42174 14.9698C9.31826 14.8152 9.18552 14.6815 9.03112 14.5782H9.03014C8.8904 14.4847 8.7146 14.4193 8.09264 14.212C6.29065 13.6113 4.89426 13.1469 3.88756 12.7188C2.92131 12.3078 2.1152 11.8553 1.7196 11.1748C1.09341 10.0978 1.09353 8.7676 1.7196 7.69047C2.11518 7.01002 2.92127 6.55751 3.88756 6.14653C4.89427 5.71838 6.29056 5.25308 8.09264 4.65239L13.2421 2.93657C15.4668 2.19498 17.2163 1.60959 18.5565 1.37114ZM20.8837 3.11625C20.5612 2.7938 20.0304 2.63224 18.8192 2.8477C17.6136 3.06221 15.9897 3.60175 13.7167 4.35942L8.56725 6.07621C6.73887 6.68567 5.41203 7.12863 4.47448 7.52739C3.49652 7.94334 3.13674 8.2375 3.01647 8.44438C2.66134 9.05544 2.66126 9.80996 3.01647 10.4209C3.13679 10.6278 3.49662 10.922 4.47448 11.3379C5.41202 11.7367 6.73893 12.1797 8.56725 12.7891C9.11042 12.9701 9.51772 13.0995 9.8651 13.3321C10.1827 13.5446 10.4554 13.8174 10.6678 14.1348C10.9004 14.4822 11.0298 14.8896 11.2108 15.4327C11.8202 17.261 12.2632 18.5879 12.662 19.5254C13.0779 20.5034 13.3721 20.8632 13.579 20.9834L13.6952 21.0459C14.2838 21.3374 14.9827 21.3164 15.5555 20.9834C15.7624 20.8632 16.0566 20.5034 16.4725 19.5254C16.8713 18.5879 17.3142 17.2611 17.9237 15.4327L19.6405 10.2832C20.3982 8.01022 20.9377 6.38636 21.1522 5.18071C21.3677 3.96955 21.2061 3.43873 20.8837 3.11625Z"
                fill={fill}
            />
            <path
                d="M17.2636 5.67782C17.5581 5.38677 18.033 5.38924 18.3242 5.68368C18.6151 5.97813 18.6125 6.45301 18.3183 6.74423L14.1074 10.9083C13.8129 11.1996 13.3381 11.1969 13.0468 10.9024C12.7556 10.6079 12.7582 10.1331 13.0527 9.84189L17.2636 5.67782Z"
                fill={fill}
            />
        </svg>
    )
}

function bubbleStyle(sender: AdminMessageSender): {
    backgroundColor: string
    color: string
    border: string
} {
    if (sender === 'customer') {
        return {
            backgroundColor: '#F5F5F3',
            color: '#1D1D1B',
            border: '1px solid #EBE8E0',
        }
    }
    if (sender === 'admin') {
        return {
            backgroundColor: '#FFF9E6',
            color: '#1D1D1B',
            border: '1px solid #FFE082',
        }
    }
    return {
        backgroundColor: '#E8F5E9',
        color: '#1B5E20',
        border: '1px solid #C8E6C9',
    }
}

function isOutgoingSender(sender: AdminMessageSender): boolean {
    return sender === 'agent' || sender === 'admin'
}

export function AdminPlayerChatTab({ userId, active }: Props) {
    const [messages, setMessages] = useState<AdminPlayerMessage[]>([])
    const [loading, setLoading] = useState(false)
    const [loadErr, setLoadErr] = useState<string | null>(null)
    const [draft, setDraft] = useState('')
    const [composerTopFade, setComposerTopFade] = useState(false)

    const listRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const stickToBottomRef = useRef(true)

    const syncComposerScrollFade = useCallback(() => {
        const el = textareaRef.current
        if (!el) return
        setComposerTopFade(el.scrollTop > 2)
    }, [])

    const adjustComposerHeight = useCallback(() => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = '0px'
        const minH = COMPOSER_LINE_HEIGHT_PX + COMPOSER_PAD_Y * 2
        const maxH = COMPOSER_LINE_HEIGHT_PX * COMPOSER_MAX_ROWS + COMPOSER_PAD_Y * 2
        const next = Math.min(maxH, Math.max(minH, el.scrollHeight))
        el.style.height = `${next}px`
        el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden'
        syncComposerScrollFade()
    }, [syncComposerScrollFade])

    useEffect(() => {
        adjustComposerHeight()
    }, [draft, adjustComposerHeight])

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        const el = listRef.current
        if (!el) return
        el.scrollTo({ top: el.scrollHeight, behavior })
    }, [])

    const loadMessages = useCallback(async () => {
        setLoading(true)
        setLoadErr(null)
        try {
            const res = await adminFetch(`/api/admin/players/${userId}/messages`)
            const j = (await res.json().catch(() => ({}))) as AdminPlayerMessagesResponse & {
                error?: string
            }
            if (!res.ok) {
                throw new Error(typeof j.error === 'string' ? j.error : res.statusText)
            }
            setMessages(j.messages ?? [])
            stickToBottomRef.current = true
        } catch (e) {
            setLoadErr(e instanceof Error ? e.message : 'Не удалось загрузить сообщения')
        } finally {
            setLoading(false)
        }
    }, [userId])

    useEffect(() => {
        if (!active) return
        setMessages([])
        void loadMessages()
    }, [active, userId, loadMessages])

    useEffect(() => {
        if (!active || !stickToBottomRef.current) return
        scrollToBottom(messages.length <= 3 ? 'auto' : 'smooth')
    }, [messages, active, scrollToBottom])

    useEffect(() => {
        if (!active) return

        const supabase = createClient()
        const channelName = `admin_player_messages_${userId}_${Date.now()}`

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'clubtac_messages',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    const parsed = parseAdminPlayerMessageRow(payload.new as Record<string, unknown>)
                    if (!parsed) return
                    setMessages((prev) => mergeAdminPlayerMessages(prev, [parsed]))
                    stickToBottomRef.current = true
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'clubtac_messages',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    const parsed = parseAdminPlayerMessageRow(payload.new as Record<string, unknown>)
                    if (!parsed) return
                    setMessages((prev) => mergeAdminPlayerMessages(prev, [parsed]))
                }
            )
            .subscribe()

        return () => {
            void supabase.removeChannel(channel)
        }
    }, [active, userId])

    const handleListScroll = () => {
        const el = listRef.current
        if (!el) return
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
        stickToBottomRef.current = distanceFromBottom < 80
    }

    const handleSend = () => {
        const text = draft.trim()
        if (!text) return
        // Отправка в Make / БД — отдельно
    }

    const messageItems = useMemo(() => {
        let lastDayKey = ''
        return messages.map((m) => {
            const dayKey = dayKeyFromIso(m.created_at)
            const showDay = dayKey !== lastDayKey
            if (showDay) lastDayKey = dayKey

            const outgoing = isOutgoingSender(m.sender)
            const bubble = bubbleStyle(m.sender)

            return (
                <div key={m.id}>
                    {showDay ? (
                        <div
                            style={{
                                textAlign: 'center',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: '#9E9E9C',
                                margin: '4px 0 10px',
                            }}
                        >
                            {formatAdminMessageDayLabel(m.created_at)}
                        </div>
                    ) : null}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: outgoing ? 'flex-end' : 'flex-start',
                            maxWidth: '88%',
                            marginLeft: outgoing ? 'auto' : 0,
                            marginRight: outgoing ? 0 : 'auto',
                        }}
                    >
                        <div
                            style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                color: '#9E9E9C',
                                marginBottom: '3px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                            }}
                        >
                            {adminMessageSenderLabel(m.sender)}
                        </div>
                        <div
                            style={{
                                padding: '9px 12px',
                                borderRadius: outgoing ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                                fontSize: '14px',
                                lineHeight: 1.45,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                ...bubble,
                            }}
                        >
                            {m.message || '—'}
                        </div>
                        <div style={{ fontSize: '10px', color: '#9E9E9C', marginTop: '3px' }}>
                            {formatAdminMessageTime(m.created_at)}
                        </div>
                    </div>
                </div>
            )
        })
    }, [messages])

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                backgroundColor: '#FAFAF8',
            }}
        >
            <div
                ref={listRef}
                onScroll={handleListScroll}
                style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    padding: '12px 12px 8px',
                }}
            >
                {loading && messages.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '13px', color: '#6B6B69' }}>Загрузка сообщений…</p>
                ) : null}

                {loadErr ? (
                    <div style={{ marginBottom: '12px' }}>
                        <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#B71C1C' }}>{loadErr}</p>
                        <button
                            type="button"
                            onClick={() => void loadMessages()}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid #1D1D1B',
                                background: '#fff',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: '13px',
                            }}
                        >
                            Повторить
                        </button>
                    </div>
                ) : null}

                {!loading && !loadErr && messages.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '13px', color: '#6B6B69', lineHeight: 1.45 }}>
                        Сообщений пока нет. Переписка с агентом появится здесь, когда пользователь напишет боту.
                    </p>
                ) : null}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{messageItems}</div>
            </div>

            <div
                style={{
                    flexShrink: 0,
                    borderTop: '1px solid #EBE8E0',
                    backgroundColor: '#FFFFFF',
                    padding: '8px 10px calc(8px + env(safe-area-inset-bottom, 0px))',
                }}
            >
                <div
                    style={{
                        position: 'relative',
                        border: '1px solid #EBE8E0',
                        borderRadius: '12px',
                        backgroundColor: '#FFFFFF',
                        overflow: 'hidden',
                    }}
                >
                    {composerTopFade ? (
                        <div
                            aria-hidden
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: '28px',
                                background:
                                    'linear-gradient(180deg, #FFFFFF 0%, rgba(255, 255, 255, 0) 100%)',
                                pointerEvents: 'none',
                                zIndex: 1,
                            }}
                        ></div>
                    ) : null}
                    <textarea
                        ref={textareaRef}
                        value={draft}
                        rows={1}
                        onChange={(e) => setDraft(e.target.value)}
                        onScroll={syncComposerScrollFade}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleSend()
                            }
                        }}
                        placeholder="Сообщение…"
                        style={{
                            display: 'block',
                            width: '100%',
                            boxSizing: 'border-box',
                            border: 'none',
                            resize: 'none',
                            outline: 'none',
                            margin: 0,
                            padding: `${COMPOSER_PAD_Y}px ${COMPOSER_PAD_X}px`,
                            paddingRight: `${SEND_BTN_SIZE + 14}px`,
                            paddingBottom: `${SEND_BTN_SIZE + 6}px`,
                            fontSize: '14px',
                            lineHeight: `${COMPOSER_LINE_HEIGHT_PX}px`,
                            fontFamily: 'inherit',
                            backgroundColor: 'transparent',
                            overflowY: 'hidden',
                        }}
                    />
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={!draft.trim()}
                        title="Отправить"
                        aria-label="Отправить"
                        style={{
                            position: 'absolute',
                            right: '6px',
                            bottom: '6px',
                            width: `${SEND_BTN_SIZE}px`,
                            height: `${SEND_BTN_SIZE}px`,
                            borderRadius: '50%',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: draft.trim() ? '#FFDF00' : '#EBE8E0',
                            cursor: draft.trim() ? 'pointer' : 'not-allowed',
                            zIndex: 2,
                        }}
                    >
                        <ChatSendIcon fill={draft.trim() ? '#1D1D1B' : '#9E9E9C'} />
                    </button>
                </div>
            </div>
        </div>
    )
}
