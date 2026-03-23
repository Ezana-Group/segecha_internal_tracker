import { ChevronRight } from "lucide-react";

/**
 * Full-width action row for profile / vehicle / mission sidebars.
 */
export function ProfileQuickActionTile({
    icon: Icon,
    label,
    hint,
    onClick,
    disabled,
    accent = "var(--brand-primary)",
    showChevron = true,
}) {
    return (
        <button
            type="button"
            className="profile-quick-action-tile"
            onClick={onClick}
            disabled={disabled}
        >
            <span className="profile-quick-action-tile__icon" style={{ color: accent }} aria-hidden>
                {Icon ? <Icon size={20} strokeWidth={2.2} /> : null}
            </span>
            <span className="profile-quick-action-tile__text">
                <span className="profile-quick-action-tile__label">{label}</span>
                {hint ? <span className="profile-quick-action-tile__hint">{hint}</span> : null}
            </span>
            {showChevron ? (
                <ChevronRight size={18} className="profile-quick-action-tile__chev" aria-hidden />
            ) : null}
        </button>
    );
}
