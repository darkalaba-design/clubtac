'use client'

import SettingsIcon from '../components/SettingsIcon'

type Props = {
    active?: boolean
    size?: number
    className?: string
    style?: React.CSSProperties
}

export default function BotTabIcon({ active = false, size = 24, className, style }: Props) {
    return (
        <SettingsIcon
            size={size}
            className={className}
            style={{
                opacity: active ? 1 : 0.45,
                ...style,
            }}
        />
    )
}
