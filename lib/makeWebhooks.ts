/** Webhook Make.com: админ → игрок (чат 1:1). */
export function getMakeAdminMessageWebhookUrl(): string | null {
    return process.env.CLUBTAC_MAKE_ADMIN_MESSAGE_WEBHOOK_URL?.trim() || null
}

/** Webhook Make.com: массовая рассылка по broadcast_id. */
export function getMakeBroadcastWebhookUrl(): string | null {
    return process.env.CLUBTAC_MAKE_BROADCAST_WEBHOOK_URL?.trim() || null
}

/** Webhook Make.com: генерация обложки события. */
export function getMakeEventCoverWebhookUrl(): string | null {
    return (
        process.env.CLUBTAC_MAKE_EVENT_COVER_WEBHOOK_URL?.trim() ||
        process.env.CLUBTAC_MAKE_EVENT_WEBHOOK_URL?.trim() ||
        null
    )
}

/** Webhook Make.com: запись пользователя на событие. */
export function getMakeEventRegistrationWebhookUrl(): string | null {
    return process.env.CLUBTAC_MAKE_EVENT_REGISTRATION_WEBHOOK_URL?.trim() || null
}
