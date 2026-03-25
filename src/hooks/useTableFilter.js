import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * useTableFilter
 * Comprehensive hook for Excel-style filtering and sorting across data tables.
 * 
 * @param {Array} items - The raw data array
 * @param {Object} options - { namespace, initialSort, searchColumns }
 */
export function useTableFilter(items, options = {}) {
    const { 
        namespace = "", 
        initialSort = { col: null, dir: null },
        searchColumns = [] 
    } = options;
    const [searchParams, setSearchParams] = useSearchParams();
    const prefix = namespace ? `${namespace}_` : "";

    // 1. Derived state directly from URL (Source of Truth)
    const filterState = useMemo(() => {
        const filters = {};
        searchParams.forEach((value, key) => {
            if (key.startsWith(prefix)) {
                const colKey = key.slice(prefix.length);
                if (colKey !== "sort_col" && colKey !== "sort_dir" && colKey !== "search") {
                    filters[colKey] = new Set(value.split(",").filter(Boolean));
                }
            }
        });
        return filters;
    }, [searchParams, prefix]);

    const sortState = useMemo(() => {
        const col = searchParams.get(`${prefix}sort_col`) || initialSort.col;
        const dir = searchParams.get(`${prefix}sort_dir`) || initialSort.dir;
        return { col, dir };
    }, [searchParams, prefix, initialSort.col, initialSort.dir]);

    const searchTerm = useMemo(() => {
        return searchParams.get(`${prefix}search`) || "";
    }, [searchParams, prefix]);

    // 2. Safely update URL (using functional update to avoid races)
    const updateURL = (updateFn) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            updateFn(next);
            // Only update if something actually changed to avoid history bloat
            if (next.toString() === prev.toString()) return prev;
            return next;
        }, { replace: true });
    };

    const applyFilter = (col, values) => {
        updateURL(next => {
            const vals = Array.from(values).filter(Boolean);
            if (vals.length > 0) {
                next.set(`${prefix}${col}`, vals.join(","));
            } else {
                next.delete(`${prefix}${col}`);
            }
        });
    };

    const clearFilter = (col) => {
        updateURL(next => {
            next.delete(`${prefix}${col}`);
        });
    };

    const clearAllFilters = () => {
        updateURL(next => {
            const keysToRemove = [];
            next.forEach((_, key) => {
                if (key.startsWith(prefix)) keysToRemove.push(key);
            });
            keysToRemove.forEach(k => next.delete(k));
        });
    };

    const setSort = (col, dir) => {
        updateURL(next => {
            if (col && dir) {
                next.set(`${prefix}sort_col`, col);
                next.set(`${prefix}sort_dir`, dir);
            } else {
                next.delete(`${prefix}sort_col`);
                next.delete(`${prefix}sort_dir`);
            }
        });
    };

    const setSearchTerm = (term) => {
        updateURL(next => {
            if (term) {
                next.set(`${prefix}search`, term);
            } else {
                next.delete(`${prefix}search`);
            }
        });
    };

    const getUniqueValues = (col) => {
        const values = new Set();
        (Array.isArray(items) ? items : []).forEach(item => {
            const val = item[col];
            if (val !== undefined && val !== null && val !== "") {
                values.add(String(val));
            }
        });
        return Array.from(values).sort((a, b) => {
            if (!isNaN(a) && !isNaN(b)) return Number(a) - Number(b);
            return a.localeCompare(b);
        });
    };

    const isFiltered = (col) => !!filterState[col]?.size;
    const isSorted = (col) => sortState.col === col;

    // 3. Derived Filtered Rows
    const filteredRows = useMemo(() => {
        let result = Array.isArray(items) ? [...items] : [];

        // Search
        if (searchTerm && searchColumns.length > 0) {
            const lowerSearch = searchTerm.toLowerCase();
            result = result.filter(item => {
                return searchColumns.some(col => {
                    const val = String(item[col] ?? "").toLowerCase();
                    return val.includes(lowerSearch);
                });
            });
        }

        // Filters
        Object.entries(filterState).forEach(([col, allowedValues]) => {
            if (allowedValues.size > 0) {
                result = result.filter(item => {
                    const val = String(item[col] ?? "");
                    return allowedValues.has(val);
                });
            }
        });

        // Sort
        if (sortState.col && sortState.dir) {
            result.sort((a, b) => {
                let vA = a[sortState.col];
                let vB = b[sortState.col];
                if (vA == null) return 1;
                if (vB == null) return -1;

                const isDate = (val) => typeof val === 'string' && (/^\d{4}-\d{2}-\d{2}/.test(val) || /^\d{2}\/\d{2}\/\d{4}/.test(val));

                if (isDate(vA) && isDate(vB)) {
                    vA = new Date(vA).getTime();
                    vB = new Date(vB).getTime();
                } else if (!isNaN(vA) && !isNaN(vB) && vA !== "" && vB !== "") {
                    vA = Number(vA); vB = Number(vB);
                } else {
                    vA = String(vA).toLowerCase(); vB = String(vB).toLowerCase();
                }

                if (vA < vB) return sortState.dir === 'asc' ? -1 : 1;
                if (vA > vB) return sortState.dir === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [items, filterState, sortState, searchTerm, searchColumns]);

    return {
        filteredRows,
        applyFilter,
        clearFilter,
        clearAllFilters,
        setSort,
        getUniqueValues,
        isFiltered,
        isSorted,
        filterState,
        sortState,
        searchTerm,
        setSearchTerm
    };
}
