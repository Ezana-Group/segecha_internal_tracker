import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Search, ArrowUp, ArrowDown, X } from "lucide-react";

/**
 * TableFilterPopup
 * Excel-style filter/sort popup.
 */
export function TableFilterPopup({ 
    column, 
    uniqueValues = [], 
    activeFilters = new Set(), 
    onApply, 
    onClear, 
    onClose, 
    anchorEl,
    sortState,
    onSort
}) {
    const [searchTerm, setSearchTerm] = useState("");
    const [pendingFilters, setPendingFilters] = useState(new Set(activeFilters));
    const [position, setPosition] = useState({ top: 0, left: 0, placement: 'bottom' });
    const popupRef = useRef(null);

    // 1. Position calculation
    useEffect(() => {
        if (!anchorEl || !popupRef.current) return;

        const anchorRect = anchorEl.getBoundingClientRect();
        const popupRect = popupRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        let top = anchorRect.bottom + window.scrollY + 8;
        let left = anchorRect.left + window.scrollX + (anchorRect.width / 2) - (popupRect.width / 2);
        let placement = 'bottom';

        // Flip upward if not enough space below
        if (top + popupRect.height > viewportHeight + window.scrollY) {
            top = anchorRect.top + window.scrollY - popupRect.height - 8;
            placement = 'top';
        }

        // Keep within horizontal bounds
        if (left < 8) left = 8;
        if (left + popupRect.width > viewportWidth - 8) left = viewportWidth - popupRect.width - 8;

        setPosition({ top, left, placement });
    }, [anchorEl]);

    // 2. Click outside & ESC handling
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (popupRef.current && !popupRef.current.contains(e.target) && !anchorEl.contains(e.target)) {
                onClose();
            }
        };
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEsc);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEsc);
        };
    }, [onClose, anchorEl]);

    // 3. Filter logic
    const filteredUniqueValues = useMemo(() => {
        return uniqueValues.filter(v => v.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [uniqueValues, searchTerm]);

    const isAllSelected = filteredUniqueValues.length > 0 && filteredUniqueValues.every(v => pendingFilters.has(v));
    const isIndeterminate = filteredUniqueValues.some(v => pendingFilters.has(v)) && !isAllSelected;

    const toggleValue = (val) => {
        const next = new Set(pendingFilters);
        if (next.has(val)) next.delete(val);
        else next.add(val);
        setPendingFilters(next);
    };

    const toggleAll = () => {
        const next = new Set(pendingFilters);
        if (isAllSelected) {
            filteredUniqueValues.forEach(v => next.delete(v));
        } else {
            filteredUniqueValues.forEach(v => next.add(v));
        }
        setPendingFilters(next);
    };

    return createPortal(
        <div 
            ref={popupRef}
            style={{
                position: "absolute",
                top: position.top,
                left: position.left,
                width: 220,
                background: "#fff",
                borderRadius: 8,
                border: "1px solid #E2E8F0",
                boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
                zIndex: 9999,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                transition: "opacity 0.15s ease",
                color: "#1e293b",
                fontFamily: "var(--font-sans)"
            }}
            className="table-filter-popup"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header / Search */}
            <div style={{ padding: "10px 10px 8px" }}>
                <div style={{ position: "relative", marginBottom: 8 }}>
                    <Search 
                        size={14} 
                        style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} 
                    />
                    <input 
                        autoFocus
                        placeholder="Search values..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: "100%",
                            height: 28,
                            padding: "0 10px 0 30px",
                            fontSize: 12,
                            border: "1px solid #E2E8F0",
                            borderRadius: 6,
                            outline: "none",
                            transition: "all 0.15s ease"
                        }}
                        onFocus={(e) => e.target.style.borderColor = "#3B82F6"}
                        onBlur={(e) => e.target.style.borderColor = "#E2E8F0"}
                    />
                </div>

                {/* Sort Buttons */}
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    <button 
                        onClick={() => onSort('asc')}
                        style={{
                            flex: 1,
                            height: 28,
                            fontSize: 11,
                            fontWeight: 600,
                            borderRadius: 6,
                            border: "1px solid",
                            borderColor: sortState?.dir === 'asc' ? "#3B82F6" : "#E2E8F0",
                            background: sortState?.dir === 'asc' ? "#E6F1FB" : "#fff",
                            color: sortState?.dir === 'asc' ? "#3B82F6" : "#475569",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                            cursor: "pointer",
                            transition: "all 0.15s ease"
                        }}
                    >
                        <ArrowUp size={12} /> Sort A-Z
                    </button>
                    <button 
                        onClick={() => onSort('desc')}
                        style={{
                            flex: 1,
                            height: 28,
                            fontSize: 11,
                            fontWeight: 600,
                            borderRadius: 6,
                            border: "1px solid",
                            borderColor: sortState?.dir === 'desc' ? "#3B82F6" : "#E2E8F0",
                            background: sortState?.dir === 'desc' ? "#E6F1FB" : "#fff",
                            color: sortState?.dir === 'desc' ? "#3B82F6" : "#475569",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                            cursor: "pointer",
                            transition: "all 0.15s ease"
                        }}
                    >
                        <ArrowDown size={12} /> Sort Z-A
                    </button>
                </div>
            </div>

            {/* Checkbox List */}
            <div style={{ borderTop: "1px solid #F1F5F9", borderBottom: "1px solid #F1F5F9" }}>
                <div 
                    onClick={toggleAll}
                    style={{ 
                        padding: "6px 12px", 
                        display: "flex", 
                        alignItems: "center", 
                        gap: 8, 
                        fontSize: 12, 
                        fontWeight: 600, 
                        cursor: "pointer",
                        background: "#F8FAFC"
                    }}
                >
                    <input 
                        type="checkbox" 
                        readOnly 
                        checked={isAllSelected} 
                        ref={el => el && (el.indeterminate = isIndeterminate)}
                        style={{ accentColor: "#3B82F6", cursor: "pointer" }}
                    />
                    Select all
                </div>
                <div style={{ maxHeight: 180, overflowY: "auto", padding: "4px 0" }}>
                    {filteredUniqueValues.length > 0 ? (
                        filteredUniqueValues.map(val => (
                            <div 
                                key={val}
                                onClick={() => toggleValue(val)}
                                style={{ 
                                    padding: "5px 12px", 
                                    display: "flex", 
                                    alignItems: "center", 
                                    gap: 8, 
                                    fontSize: 12, 
                                    cursor: "pointer",
                                    transition: "background 0.15s ease"
                                }}
                                className="filter-row-hover"
                                onMouseEnter={(e) => e.target.style.background = "#F8FAFC"}
                                onMouseLeave={(e) => e.target.style.background = "transparent"}
                            >
                                <input 
                                    type="checkbox" 
                                    readOnly 
                                    checked={pendingFilters.has(val)} 
                                    style={{ accentColor: "#3B82F6", cursor: "pointer" }}
                                />
                                {val}
                            </div>
                        ))
                    ) : (
                        <div style={{ padding: "20px 12px", textAlign: "center", fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>
                            No values match
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Buttons */}
            <div style={{ padding: 10, display: "flex", gap: 8 }}>
                <button 
                    onClick={() => {
                        onClear();
                        onClose();
                    }}
                    style={{
                        flex: 1,
                        height: 32,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#64748b",
                        background: "#fff",
                        border: "1px solid #E2E8F0",
                        borderRadius: 6,
                        cursor: "pointer",
                        transition: "all 0.15s ease"
                    }}
                    onMouseEnter={(e) => e.target.style.borderColor = "#CBD5E1"}
                    onMouseLeave={(e) => e.target.style.borderColor = "#E2E8F0"}
                >
                    Clear
                </button>
                <button 
                    onClick={() => {
                        onApply(pendingFilters);
                        onClose();
                    }}
                    style={{
                        flex: 1,
                        height: 32,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#fff",
                        background: "#3B82F6",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        transition: "all 0.15s ease"
                    }}
                    onMouseEnter={(e) => e.target.style.background = "#2563EB"}
                    onMouseLeave={(e) => e.target.style.background = "#3B82F6"}
                >
                    Apply
                </button>
            </div>
        </div>,
        document.body
    );
}
