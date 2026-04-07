/* ─── Badge ────────────────────────────────────────────────────────
   Pill badge with a dot indicator.
   Props: children | status | className | style
   Color mapping via SC from constants/theme.
   ──────────────────────────────────────────────────────────────── */
import { SC } from "../constants/theme";

export function Badge({ children, status, className = "", style: propStyle, ...props }) {
    const color = SC[status] || "#64748b";

    const badgeStyle = {
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "3px 9px 3px 7px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 700,
        lineHeight: 1.4,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        background: `${color}15`,
        color: color,
        border: `1px solid ${color}30`,
        whiteSpace: "nowrap",
        ...propStyle,
    };

    const dotStyle = {
        display: "inline-block",
        width: 5,
        height: 5,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
        opacity: 0.9,
    };

    return (
        <span
            className={`badge ${className}`.trim()}
            style={badgeStyle}
            {...props}
        >
            <span style={dotStyle} aria-hidden />
            {children || status}
        </span>
    );
}
