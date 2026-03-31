import React, { useState } from "react";
import { ChevronUp, ChevronDown, Filter } from "lucide-react";
import { TableFilterPopup } from "./TableFilterPopup";

/**
 * SortableTableHead
 * A reusable component to render sortable table headers with Excel-style filtering.
 */
export function SortableTableHead({ 
    columns, 
    // Generic names to match useTableFilter return values easily
    requestSort,     // Function to set sort: (col, dir) => void
    sortConfig,      // Current sort state: { col, dir }
    filterState = {}, // Current filter state: { [col]: Set<string> }
    onFilterChange,  // Function to apply filter: (col, values) => void
    getUniqueValues, // Function to get unique values for a column: (col) => string[]
    
    // Optional aliases/overrides
    onSort,
    sortState,
    filters,
    isFiltered: isFilteredProp,
    isSorted: isSortedProp
}) {
    const [activeColumn, setActiveColumn] = useState(null);
    const [anchorEl, setAnchorEl] = useState(null);

    // Resolve props with fallbacks
    const effectiveSortState = sortState || sortConfig || { col: null, dir: null };
    const effectiveFilterState = filters || filterState || {};
    const effectiveOnSort = onSort || requestSort;

    return (
        <thead>
            <tr>
                {columns.map((col, index) => {
                    const filtered = isFilteredProp?.(col.key) || (effectiveFilterState[col.key]?.size > 0);
                    const sorted = isSortedProp?.(col.key) || (effectiveSortState.col === col.key);
                    const isActive = filtered || sorted;
                    const isFirst = index === 0;

                    return (
                        <th
                            key={col.key}
                            className={[isFirst ? "sticky-col" : "", col.className || ""].filter(Boolean).join(" ")}
                            style={{
                                verticalAlign: "middle",
                                padding: "12px 16px",
                                position: isFirst ? "sticky" : "relative",
                                ...col.style
                            }}
                        >
                            <div 
                                onClick={(e) => {
                                    if (col.sortable !== false) {
                                        setActiveColumn(col.key);
                                        setAnchorEl(e.currentTarget);
                                    }
                                }}
                                title={col.label}
                                style={{ 
                                    display: "flex", 
                                    alignItems: "center", 
                                    gap: 6, 
                                    justifyContent: col.align === "right" ? "flex-end" : "flex-start",
                                    cursor: col.sortable !== false ? "pointer" : "default",
                                    userSelect: "none",
                                    color: isActive ? "#3B82F6" : "inherit",
                                    transition: "color 0.15s ease"
                                }}
                                className={col.sortable !== false ? "sortable-header" : ""}
                            >
                                <span style={{ fontWeight: isActive ? 700 : 600 }}>{col.label}</span>
                                
                                {col.sortable !== false && (
                                    <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
                                        {sorted ? (
                                            effectiveSortState.dir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                        ) : (
                                            <Filter size={12} style={{ opacity: filtered ? 1 : 0.3 }} />
                                        )}
                                        {filtered && (
                                            <div style={{ 
                                                position: "absolute", 
                                                top: -2, 
                                                right: -2, 
                                                width: 6, 
                                                height: 6, 
                                                background: "#3B82F6", 
                                                borderRadius: "50%",
                                                border: "1px solid #fff"
                                            }} />
                                        )}
                                    </div>
                                )}
                            </div>

                            {activeColumn === col.key && (
                                <TableFilterPopup 
                                    column={col}
                                    uniqueValues={getUniqueValues?.(col.key) || []}
                                    activeFilters={effectiveFilterState[col.key] || new Set()}
                                    sortState={effectiveSortState.col === col.key ? effectiveSortState : null}
                                    onApply={(values) => onFilterChange(col.key, values)}
                                    onClear={() => onFilterChange(col.key, new Set())}
                                    onSort={(dir) => effectiveOnSort(col.key, dir)}
                                    onClose={() => setActiveColumn(null)}
                                    anchorEl={anchorEl}
                                />
                            )}
                        </th>
                    );
                })}
            </tr>
        </thead>
    );
}
