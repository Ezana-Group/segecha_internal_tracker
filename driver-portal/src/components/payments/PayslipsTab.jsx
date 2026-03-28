import React, { useMemo, useState } from 'react';
import { COLORS, S } from '../../constants/theme';
import { fmt } from '../../utils/formatters';

export const PayslipsTab = ({ portalPerm, payslips = [], activeJourneys = [], completedJourneys = [], driver = {} }) => {
    const [subTab, setSubTab] = useState('summary'); // summary | history
    
    const allJourneys = useMemo(() => [...activeJourneys, ...completedJourneys], [activeJourneys, completedJourneys]);
    
    // 1. Current Month Breakdown
    const monthKey = new Date().toISOString().slice(0, 7);
    const thisMonthJourneys = allJourneys.filter(j => j.date && j.date.startsWith(monthKey));
    const thisMonthAllowances = thisMonthJourneys.reduce((s, j) => {
        const allowanceExp = expenses.find(e => e.journey === j.id && e.cat === 'Allowance' && e.amount > 0);
        const amt = allowanceExp ? +allowanceExp.amount : (+j.driverMileage || 0);
        return s + amt + (+j.roadUserAllowance || 0);
    }, 0);
    const thisMonthSal = +(driver.salary || driver.baseSalary || 0);

    // 2. Year-to-Date (Summary from payslips + current month)
    const currentYear = new Date().getFullYear();
    const paidThisYear = payslips
        .filter(p => p.month?.startsWith(String(currentYear)) && p.status === 'Paid')
        .reduce((s, p) => s + (+p.netPay || ((+p.baseSalary || 0) + (+p.allowance || 0) - (+p.deductions || 0))), 0);

    const SummaryView = () => (
        <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', borderRadius: 20, padding: 24, color: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
                <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Estimated Balance</div>
                <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 4 }}>{fmt(thisMonthSal + thisMonthAllowances)}</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>Current Month ({new Date().toLocaleDateString('en-KE', { month: 'long' })})</div>
                
                <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                        <div style={{ fontSize: 10, opacity: 0.6, fontWeight: 700, marginBottom: 4 }}>BASE SALARY</div>
                        <div style={{ fontSize: 16, fontWeight: 800 }}>{fmt(thisMonthSal)}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 10, opacity: 0.6, fontWeight: 700, marginBottom: 4 }}>ALLOWANCES</div>
                        <div style={{ fontSize: 16, fontWeight: 800 }}>{fmt(thisMonthAllowances)}</div>
                    </div>
                </div>
            </div>

            <div style={{ ...S.card(), padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.text }}>Year-to-Date {currentYear}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: COLORS.green }}>{fmt(paidThisYear)}</div>
                </div>
                <div style={{ fontSize: 12, color: COLORS.textFaint, lineHeight: 1.45 }}>
                    Total amount confirmed as <b>Paid</b> this calendar year (excluding the current month which is pending).
                </div>
            </div>

            <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: COLORS.text, marginBottom: 12, paddingLeft: 4 }}>This Month's Trips</div>
                {thisMonthJourneys.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 32, color: COLORS.textFaint, background: '#fff', borderRadius: 16, border: `1px dashed ${COLORS.border}` }}>
                        No trips logged yet this month.
                    </div>
                ) : (
                    thisMonthJourneys.map(j => {
                        const allowanceExp = expenses.find(e => e.journey === j.id && e.cat === 'Allowance' && e.amount > 0);
                        const amt = allowanceExp ? +allowanceExp.amount : (+j.driverMileage || 0);
                        return (
                            <div key={j.id} style={{ ...S.card(), padding: 12, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{j.origin} → {j.dest}</div>
                                    <div style={{ fontSize: 11, color: COLORS.textFaint }}>{j.date}</div>
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.text }}>+{fmt(amt + (j.roadUserAllowance || 0))}</div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );

    const HistoryView = () => (
        <div style={{ display: 'grid', gap: 14 }}>
            {payslips.length === 0 ? (
                <div style={{ ...S.card(), textAlign: 'center', padding: 28, color: COLORS.textFaint }}>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                    <div>No payment records found</div>
                </div>
            ) : (
                [...payslips].reverse().map((p) => (
                    <div key={p.id} style={S.card(p.status === 'Paid' ? COLORS.green : COLORS.yellow)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.text }}>{new Date(p.month + '-01').toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })}</div>
                            <span style={S.badge(p.status)}>{p.status}</span>
                        </div>
                        {(() => {
                            const net = +p.netPay || ((+p.baseSalary || 0) + (+p.allowance || 0) - (+p.deductions || 0));
                            return (
                                <div style={{ fontSize: 20, fontWeight: 900, color: p.status === 'Paid' ? COLORS.green : COLORS.text, marginBottom: 4 }}>
                                    {fmt(net)}
                                </div>
                            );
                        })()}
                        {p.status === 'Paid' && p.paidDate && <div style={{ fontSize: 12, color: COLORS.textDim }}>Paid {p.paidDate}</div>}
                    </div>
                ))
            )}
        </div>
    );

    return (
        <div style={S.content}>
            <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: 12, padding: 4, marginBottom: 20 }}>
                <button
                    style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: subTab === 'summary' ? '#fff' : 'transparent', color: subTab === 'summary' ? COLORS.primary : COLORS.textFaint, boxShadow: subTab === 'summary' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
                    onClick={() => setSubTab('summary')}
                >
                    📊 Summary
                </button>
                <button
                    style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: subTab === 'history' ? '#fff' : 'transparent', color: subTab === 'history' ? COLORS.primary : COLORS.textFaint, boxShadow: subTab === 'history' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
                    onClick={() => setSubTab('history')}
                >
                    📜 History
                </button>
            </div>

            {subTab === 'summary' ? <SummaryView /> : <HistoryView />}
        </div>
    );
};
