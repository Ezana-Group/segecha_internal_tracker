import { SC } from "../constants/theme";

export function Badge({ children, status, className = "", ...props }) {
    const color = SC[status] || "#64748b";
    
    return (
        <span 
            className={`badge-modern ${className}`}
            style={{ 
                display: "inline-flex",
                alignItems: "center",
                lineHeight: 1.25,
                padding: "5px 12px",
                borderRadius: "999px",
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                background: `${color}18`,
                color: color,
                border: `1px solid ${color}35`,
                ...props.style
            }}
            {...props}
        >
            {children || status}
        </span>
    );
}
