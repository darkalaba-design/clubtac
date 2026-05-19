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

const CHAT_EMOJIS = [
    '😀', '😁', '😂', '🤣', '😊', '🙂', '😉', '😍', '🥰', '😘',
    '😎', '🤔', '😅', '😭', '😡', '👍', '👎', '🙏', '👋', '❤️',
    '🔥', '⭐', '✅', '❌', '💪', '🎉', '🤝', '💬', '📎', '⏳',
]

type Props = {
    userId: number
    usernameUrl: string | null
    active: boolean
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

export function AdminPlayerChatTab({ userId, usernameUrl, active }: Props) {
    const [messages, setMessages] = useState<AdminPlayerMessage[]>([])
    const [loading, setLoading] = useState(false)
    const [loadErr, setLoadErr] = useState<string | null>(null)
    const [draft, setDraft] = useState('')
    const [emojiOpen, setEmojiOpen] = useState(false)

    const listRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const stickToBottomRef = useRef(true)

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

    const insertEmoji = (emoji: string) => {
        const ta = textareaRef.current
        if (!ta) {
            setDraft((prev) => prev + emoji)
            return
        }
        const start = ta.selectionStart ?? draft.length
        const end = ta.selectionEnd ?? draft.length
        const next = draft.slice(0, start) + emoji + draft.slice(end)
        setDraft(next)
        requestAnimationFrame(() => {
            ta.focus()
            const pos = start + emoji.length
            ta.setSelectionRange(pos, pos)
        })
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
            {usernameUrl ? (
                <div
                    style={{
                        flexShrink: 0,
                        padding: '8px 12px',
                        borderBottom: '1px solid #EBE8E0',
                        backgroundColor: '#FFFFFF',
                    }}
                >
                    <a
                        href={usernameUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#229ED9',
                            textDecoration: 'none',
                        }}
                    >
                        Открыть чат в Telegram
                    </a>
                </div>
            ) : null}

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
                    padding: '10px 12px calc(10px + env(safe-area-inset-bottom, 0px))',
                }}
            >
                {emojiOpen ? (
                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '4px',
                            marginBottom: '8px',
                            padding: '8px',
                            borderRadius: '10px',
                            border: '1px solid #EBE8E0',
                            backgroundColor: '#FAFAF8',
                            maxHeight: '120px',
                            overflowY: 'auto',
                        }}
                    >
                        {CHAT_EMOJIS.map((emoji) => (
                            <button
                                key={emoji}
                                type="button"
                                onClick={() => insertEmoji(emoji)}
                                style={{
                                    width: '36px',
                                    height: '36px',
                                    border: 'none',
                                    borderRadius: '8px',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    fontSize: '20px',
                                    lineHeight: 1,
                                }}
                                aria-label={`Вставить ${emoji}`}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                ) : null}

                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    <button
                        type="button"
                        onClick={() => setEmojiOpen((v) => !v)}
                        aria-expanded={emojiOpen}
                        aria-label="Эмодзи"
                        style={{
                            flexShrink: 0,
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            border: '1px solid #EBE8E0',
                            background: emojiOpen ? '#FFF9E6' : '#FAFAF8',
                            cursor: 'pointer',
                            fontSize: '20px',
                            lineHeight: 1,
                        }}
                    >
                        😊
                    </button>
                    <textarea
                        ref={textareaRef}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleSend()
                            }
                        }}
                        placeholder="Сообщение…"
                        rows={2}
                        style={{
                            flex: 1,
                            minWidth: 0,
                            resize: 'none',
                            borderRadius: '10px',
                            border: '1px solid #EBE8E0',
                            padding: '10px 12px',
                            fontSize: '14px',
                            lineHeight: 1.4,
                            fontFamily: 'inherit',
                            outline: 'none',
                        }}
                    />
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={!draft.trim()}
                        title="Отправка будет подключена позже"
                        style={{
                            flexShrink: 0,
                            padding: '10px 14px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: draft.trim() ? '#1B5E20' : '#E0E0DE',
                            color: draft.trim() ? '#FFFFFF' : '#9E9E9C',
                            fontWeight: 700,
                            fontSize: '14px',
                            cursor: draft.trim() ? 'pointer' : 'not-allowed',
                        }}
                    >
                        Отправить
                    </button>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#9E9E9C' }}>
                    Enter — отправить, Shift+Enter — новая строка. Запись в чат подключим отдельно.
                </p>
            </div>
        </div>
    )
}
