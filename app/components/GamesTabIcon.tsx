'use client'

import { useId } from 'react'

type GamesTabIconProps = {
    active?: boolean
    size?: number
    className?: string
    style?: React.CSSProperties
}

export default function GamesTabIcon({ active = false, size = 24, className, style }: GamesTabIconProps) {
    const clipId = `games-tab-clip-${useId().replace(/:/g, '')}`

    if (active) {
        return (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
                className={className}
                style={style}
            >
                <g clipPath={`url(#${clipId})`}>
                    <path
                        d="M12 0C18.6239 8.97428e-07 24 5.37608 24 12C24 18.6239 18.6239 24 12 24C5.37607 24 0 18.6239 0 12C4.49207e-06 5.37608 5.36669 0 12 0ZM9.80957 5.14941C9.4341 4.46901 8.57797 4.22133 7.89746 4.59668C6.48309 5.37688 5.3207 6.55286 4.55273 7.97559C4.18355 8.65957 4.43907 9.51363 5.12305 9.88281C5.80697 10.2517 6.66018 9.99636 7.0293 9.3125C7.54178 8.36305 8.31748 7.57974 9.25684 7.06152C9.93741 6.68612 10.185 5.82999 9.80957 5.14941Z"
                        fill="#1D1D1B"
                    />
                </g>
                <defs>
                    <clipPath id={clipId}>
                        <rect width="24" height="24" fill="white" />
                    </clipPath>
                </defs>
            </svg>
        )
    }

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
            className={className}
            style={style}
        >
            <g clipPath={`url(#${clipId})`}>
                <path
                    d="M12 0.75C18.2097 0.750001 23.25 5.79029 23.25 12C23.25 18.2097 18.2097 23.25 12 23.25C5.79029 23.25 0.75 18.2097 0.75 12C0.750004 5.78991 5.78129 0.75 12 0.75Z"
                    stroke="#1D1D1B"
                    strokeWidth="1.5"
                />
                <path
                    d="M7.89779 4.59702C8.57837 4.22164 9.43433 4.46903 9.80974 5.1496C10.1851 5.83018 9.93773 6.68615 9.25716 7.06156C8.31769 7.57977 7.54215 8.36316 7.02963 9.3127C6.66045 9.99668 5.80659 10.2519 5.12261 9.88274C4.43863 9.51356 4.18338 8.6597 4.55256 7.97572C5.32055 6.55289 6.48331 5.37725 7.89779 4.59702Z"
                    fill="#1D1D1B"
                />
            </g>
            <defs>
                <clipPath id={clipId}>
                    <rect width="24" height="24" fill="white" />
                </clipPath>
            </defs>
        </svg>
    )
}
