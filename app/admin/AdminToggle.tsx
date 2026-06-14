'use client'

import type { CSSProperties } from 'react'

type Props = {
    checked: boolean
    onChange: (next: boolean) => void
    disabled?: boolean
    label: string
    description?: string
    id?: string
}

const trackStyle = (checked: boolean, disabled: boolean): CSSProperties => ({
    position: 'relative',
    width: '46px',
    height: '28px',
    borderRadius: '999px',
    border: 'none',
    padding: 0,
    flexShrink: 0,
    backgroundColor: checked ? '#1B5E20' : '#D8D5CE',
    opacity: disabled ? 0.55 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background-color 0.2s ease',
})

const thumbStyle = (checked: boolean): CSSProperties => ({
    position: 'absolute',
    top: '3px',
    left: checked ? '21px' : '3px',
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    backgroundColor: '#FFFFFF',
    boxShadow: '0 1px 4px rgba(29,29,27,0.22)',
    transition: 'left 0.2s ease',
})

export function AdminToggle({
    checked,
    onChange,
    disabled = false,
    label,
    description,
    id = 'admin-toggle',
}: Props) {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '14px',
            }}
        >
            <div style={{ minWidth: 0, flex: 1 }}>
                <div
                    id={`${id}-label`}
                    style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#1D1D1B',
                        lineHeight: 1.3,
                    }}
                >
                    {label}
                </div>
                {description ? (
                    <div style={{ marginTop: '4px', fontSize: '12px', color: '#6B6B69', lineHeight: 1.45 }}>
                        {description}
                    </div>
                ) : null}
            </div>

            <button
                type="button"
                role="switch"
                id={id}
                aria-checked={checked}
                aria-labelledby={`${id}-label`}
                disabled={disabled}
                onClick={() => {
                    if (disabled) return
                    onChange(!checked)
                }}
                style={trackStyle(checked, disabled)}
            >
                <span aria-hidden style={thumbStyle(checked)} />
            </button>
        </div>
    )
}
