import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Bug } from "lucide-react";
import { fetchWithAuth } from "../utils/api";
import { Button } from "../components/Button";
import { Card } from "../components/Card";

const SOURCES = ["", "admin", "driver", "track", "payment", "server"];

export function ErrorLogs({ S }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [source, setSource] = useState("");
    const [err, setErr] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setErr("");
        try {
            const q = new URLSearchParams({ limit: "200" });
            if (source) q.set("source", source);
            const path = `/api/admin/error-logs?${q.toString()}`;
            const res = await fetchWithAuth(path);
            const j = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(j.error || res.statusText);
            setLogs(Array.isArray(j.logs) ? j.logs : []);
        } catch (e) {
            setErr(e.message || "Failed to load logs");
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }, [source]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div className="page-shell">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 900, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                        <Bug size={28} color="var(--brand-primary)" aria-hidden />
                        Error logs
                    </h1>
                    <p style={{ color: "var(--text-muted)", margin: "8px 0 0", fontSize: 14 }}>
                        Client-side errors from the dashboard, driver portal, track portal, and payment portal.
                    </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <select
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                        style={{
                            ...(S?.inp || {}),
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: "1px solid var(--border-medium)",
                            background: "var(--bg-surface)",
                            color: "var(--text-primary)",
                            fontSize: 13,
                            fontWeight: 600,
                        }}
                    >
                        <option value="">All sources</option>
                        {SOURCES.filter(Boolean).map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                    <Button variant="secondary" icon={RefreshCw} onClick={load} disabled={loading}>
                        Refresh
                    </Button>
                </div>
            </div>

            {err && (
                <div style={{ padding: 14, borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fecaca", marginBottom: 16, fontSize: 14 }}>
                    {err}
                </div>
            )}

            <Card style={{ padding: 0, overflow: "hidden" }}>
                <div className="table-container">
                    <table className="table-modern">
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Source</th>
                                <th>Level</th>
                                <th>Message</th>
                                <th>URL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                                        Loading…
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                                        No errors recorded yet.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((row) => (
                                    <tr key={row.id}>
                                        <td style={{ whiteSpace: "nowrap", fontSize: 12, color: "var(--text-dim)" }}>
                                            {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                                        </td>
                                        <td>
                                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700 }}>{row.source}</span>
                                        </td>
                                        <td>{row.level}</td>
                                        <td style={{ maxWidth: 320 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{row.message}</div>
                                            {row.stack && (
                                                <pre
                                                    style={{
                                                        marginTop: 8,
                                                        fontSize: 10,
                                                        color: "var(--text-dim)",
                                                        whiteSpace: "pre-wrap",
                                                        wordBreak: "break-word",
                                                        maxHeight: 120,
                                                        overflow: "auto",
                                                    }}
                                                >
                                                    {row.stack}
                                                </pre>
                                            )}
                                        </td>
                                        <td style={{ maxWidth: 200, fontSize: 11, color: "var(--text-muted)", wordBreak: "break-all" }}>
                                            {row.url || "—"}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
