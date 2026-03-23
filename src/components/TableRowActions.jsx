import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

const CLOSE_EVENT = "segecha-close-table-row-menus";

/**
 * @typedef {{ id?: string, label: string, icon?: import("lucide-react").LucideIcon, onClick: (e: import("react").MouseEvent) => void, danger?: boolean, disabled?: boolean }} TableRowActionItem
 */

/**
 * "⋯" trigger with fixed dropdown (portal) so overflow:hidden tables do not clip the menu.
 * @param {{ items: TableRowActionItem[], ariaLabel?: string }} props
 */
export function TableRowActions({ items, ariaLabel = "Row actions" }) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const triggerRef = useRef(null);
    const instanceId = useRef(`tra-${Math.random().toString(36).slice(2)}`);
    const menuId = useId();

    useEffect(() => {
        const onCloseOthers = (e) => {
            if (e.detail !== instanceId.current) setOpen(false);
        };
        window.addEventListener(CLOSE_EVENT, onCloseOthers);
        return () => window.removeEventListener(CLOSE_EVENT, onCloseOthers);
    }, []);

    useLayoutEffect(() => {
        if (!open || !triggerRef.current) return;
        const r = triggerRef.current.getBoundingClientRect();
        const menuWidth = 220;
        const pad = 8;
        let left = r.right - menuWidth;
        if (left < pad) left = pad;
        if (left + menuWidth > window.innerWidth - pad) {
            left = Math.max(pad, window.innerWidth - menuWidth - pad);
        }
        let top = r.bottom + 6;
        const estimatedH = Math.min(items.filter((i) => !i.disabled).length * 44 + 16, 320);
        if (top + estimatedH > window.innerHeight - pad) {
            top = Math.max(pad, r.top - estimatedH - 6);
        }
        setPos({ top, left });
    }, [open, items.length]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === "Escape") setOpen(false);
        };
        const onScroll = () => setOpen(false);
        window.addEventListener("keydown", onKey);
        window.addEventListener("scroll", onScroll, true);
        window.addEventListener("resize", onScroll);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("scroll", onScroll, true);
            window.removeEventListener("resize", onScroll);
        };
    }, [open]);

    const visible = items.filter((i) => i && typeof i.onClick === "function");
    if (visible.length === 0) return null;

    const toggle = (e) => {
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent(CLOSE_EVENT, { detail: instanceId.current }));
        setOpen((o) => !o);
    };

    const runItem = (e, item) => {
        e.stopPropagation();
        if (item.disabled) return;
        setOpen(false);
        item.onClick(e);
    };

    const portal =
        open &&
        typeof document !== "undefined" &&
        createPortal(
            <>
                <div
                    className="table-row-actions-backdrop"
                    aria-hidden
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setOpen(false);
                    }}
                />
                <div
                    id={menuId}
                    role="menu"
                    aria-label={ariaLabel}
                    className="table-row-actions-menu"
                    style={{ top: pos.top, left: pos.left }}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    {visible.map((item) => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id || item.label}
                                type="button"
                                role="menuitem"
                                disabled={item.disabled}
                                className={`table-row-actions-item${item.danger ? " table-row-actions-item--danger" : ""}`}
                                onClick={(e) => runItem(e, item)}
                            >
                                {Icon && <Icon size={16} strokeWidth={2} className="table-row-actions-item-icon" aria-hidden />}
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </>,
            document.body
        );

    return (
        <div className="table-row-actions" onClick={(e) => e.stopPropagation()}>
            <button
                ref={triggerRef}
                type="button"
                className="table-row-actions-trigger"
                aria-label={ariaLabel}
                aria-expanded={open}
                aria-haspopup="menu"
                aria-controls={open ? menuId : undefined}
                onClick={toggle}
            >
                <MoreHorizontal size={18} strokeWidth={2} aria-hidden />
            </button>
            {portal}
        </div>
    );
}
