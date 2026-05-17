const FILL = '#1D1D1B'

const CHEVRON_DOWN =
    'M15.4697 9.21967C15.7626 8.92678 16.2373 8.92678 16.5302 9.21967C16.8231 9.51256 16.8231 9.98732 16.5302 10.2802L12.5302 14.2802C12.2373 14.5731 11.7626 14.5731 11.4697 14.2802L7.46967 10.2802C7.17678 9.98732 7.17678 9.51256 7.46967 9.21967C7.76256 8.92678 8.23732 8.92678 8.53022 9.21967L11.9999 12.6894L15.4697 9.21967Z'

const CHEVRON_UP =
    'M15.4697 13.7803C15.7626 14.0732 16.2373 14.0732 16.5302 13.7803C16.8231 13.4874 16.8231 13.0127 16.5302 12.7198L12.5302 8.71978C12.2373 8.42689 11.7626 8.42689 11.4697 8.71978L7.46967 12.7198C7.17678 13.0127 7.17678 13.4874 7.46967 13.7803C7.76256 14.0732 8.23732 14.0732 8.53022 13.7803L11.9999 10.3106L15.4697 13.7803Z'

type ExpandChevronIconProps = {
    open?: boolean
    size?: number
    className?: string
    style?: React.CSSProperties
}

/** Шеврон раскрытия блока: вниз (свёрнуто) / вверх (открыто) */
export default function ExpandChevronIcon({ open = false, size = 24, className, style }: ExpandChevronIconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
            className={className}
            style={{ display: 'block', flexShrink: 0, ...style }}
        >
            <path d={open ? CHEVRON_UP : CHEVRON_DOWN} fill={FILL} />
        </svg>
    )
}
