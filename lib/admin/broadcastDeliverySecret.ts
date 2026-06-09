export function getBroadcastDeliverySecret(): string | null {
    return process.env.CLUBTAC_BROADCAST_DELIVERY_SECRET?.trim() || null
}

export function isValidBroadcastDeliverySecret(provided: string | null | undefined): boolean {
    const expected = getBroadcastDeliverySecret()
    if (!expected) return false
    return !!provided?.trim() && provided.trim() === expected
}
