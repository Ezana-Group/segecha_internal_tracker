import { CircleDot, Gauge, AlertTriangle, Pencil } from "lucide-react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { PageHeader } from "../components/PageHeader";
import { fmt, fmtN } from "../utils/formatters";

const DEFAULT_TYRE_LIMIT_KM = 60000;

export function TyreMonitor({ data, dark, openModal, tyreStatus, truckReg }) {
    const tyreRows = (data.trucks || []).map((t) => {
        const ts = tyreStatus(t);
        const limit = Number(t.tyreLimit) > 0 ? Number(t.tyreLimit) : DEFAULT_TYRE_LIMIT_KM;
        const rulePct = Math.min(100, parseFloat(ts.pct) || 0);
        return { truck: t, ts, limit, rulePct };
    });

    const tyreExpenses = (data.expenses || [])
        .filter((e) => e.cat === "Tyre")
        .sort((a, b) => b.date.localeCompare(a.date));

    return (
        <div className="page-shell">
            <PageHeader
                icon={CircleDot}
                title="Tyre health"
                description="Kilometres since baseline, wear vs maintenance interval, and tyre-category spend."
            />

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                    gap: 20,
                    marginBottom: 28,
                }}
            >
                {tyreRows.map(({ truck: t, ts, limit, rulePct }) => {
                    const alertColor =
                        ts.status === "Overdue" ? "#dc2626" : ts.status === "Due Soon" ? "#ea580c" : "#059669";
                    return (
                        <Card key={t.id} className="animate-fade-in" style={{ padding: 20 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: 18, color: "var(--text-primary)" }}>{t.reg}</div>
                                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                                        {t.make} · {t.type}
                                    </div>
                                </div>
                                <Badge status={ts.status === "OK" ? "Active" : ts.status === "Due Soon" ? "Due Soon" : "Overdue"}>
                                    {ts.status}
                                </Badge>
                            </div>

                            <div style={{ marginBottom: 14 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
                                    <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Vs maintenance rule</span>
                                    <span style={{ color: alertColor, fontWeight: 700 }}>
                                        {ts.kmSince.toLocaleString()} km since baseline
                                    </span>
                                </div>
                                <div
                                    style={{
                                        height: 8,
                                        borderRadius: 999,
                                        background: dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)",
                                        overflow: "hidden",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${rulePct}%`,
                                            maxWidth: "100%",
                                            height: "100%",
                                            borderRadius: 999,
                                            background: alertColor,
                                            transition: "width 0.35s ease",
                                        }}
                                    />
                                </div>
                                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6, textAlign: "right" }}>
                                    {fmtN(rulePct, 1)}% of tyre replacement interval (Settings → Maintenance)
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                                {[
                                    { l: "Remaining", v: ts.remaining <= 0 ? `${Math.abs(ts.remaining).toLocaleString()} km over` : `${ts.remaining.toLocaleString()} km`, c: alertColor },
                                    { l: "Baseline odometer", v: `${Number(t.tyreOdom || 0).toLocaleString()} km`, c: "var(--text-secondary)" },
                                    { l: "Current odometer", v: `${Number(t.odom || 0).toLocaleString()} km`, c: "var(--text-secondary)" },
                                    { l: "Interval (vehicle)", v: `${limit.toLocaleString()} km`, c: "var(--text-secondary)" },
                                ].map((row) => (
                                    <div
                                        key={row.l}
                                        style={{
                                            background: dark ? "rgba(255,255,255,0.04)" : "var(--bg-surface)",
                                            borderRadius: 10,
                                            padding: "10px 12px",
                                            border: "1px solid var(--border-subtle)",
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 10,
                                                fontWeight: 700,
                                                color: "var(--text-dim)",
                                                textTransform: "uppercase",
                                                letterSpacing: "0.06em",
                                                marginBottom: 4,
                                            }}
                                        >
                                            {row.l}
                                        </div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: row.c }}>{row.v}</div>
                                    </div>
                                ))}
                            </div>

                            {ts.status !== "OK" && (
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "flex-start",
                                        gap: 10,
                                        background: dark ? "rgba(220,38,38,0.12)" : "rgba(220,38,38,0.08)",
                                        border: `1px solid ${alertColor}40`,
                                        borderRadius: 10,
                                        padding: 12,
                                        fontSize: 13,
                                        color: alertColor,
                                        fontWeight: 600,
                                        marginBottom: 14,
                                    }}
                                >
                                    <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                                    <span>
                                        {ts.status === "Overdue"
                                            ? "Tyres are past the replacement interval. Plan change immediately."
                                            : "Approaching replacement interval. Schedule a tyre change."}
                                    </span>
                                </div>
                            )}

                            <Button variant="secondary" size="sm" icon={Pencil} onClick={() => openModal("truck", t)} style={{ width: "100%" }}>
                                Update odometer / tyre data
                            </Button>
                        </Card>
                    );
                })}
            </div>

            <Card title="Tyre replacement spend" subtitle="Expense lines categorised as Tyre" icon={Gauge} style={{ padding: 20 }}>
                <div style={{ overflowX: "auto" }}>
                    <table className="table-modern">
                        <thead>
                            <tr>
                                {["Date", "Vehicle", "Description", "Amount"].map((h) => (
                                    <th key={h}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {tyreExpenses.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                                        No tyre expenses recorded yet.
                                    </td>
                                </tr>
                            ) : (
                                tyreExpenses.map((e) => (
                                    <tr key={e.id}>
                                        <td>{e.date}</td>
                                        <td style={{ fontWeight: 700, color: "var(--brand-primary)" }}>{truckReg(e.truck)}</td>
                                        <td>{e.desc}</td>
                                        <td style={{ fontWeight: 700 }}>{fmt(e.amount)}</td>
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
