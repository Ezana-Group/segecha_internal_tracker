import React, { useState, useRef, useEffect } from 'react';
import { Bell, Droplet, Wallet, ShieldCheck, X, ArrowRight } from 'lucide-react';
import { Badge } from './Badge';
import { Button } from './Button';
import { fmt } from '../utils/formatters';

export function NotificationCenter({ pendingVerifications, setVerifyModal, truckReg, driverName, dark }) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    const count = (pendingVerifications || []).length;

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    return (
        <div className="relative" ref={containerRef} style={{ position: 'relative' }}>
            <button
                type="button"
                className={`topbar-icon-btn ${open ? 'active' : ''}`}
                onClick={() => setOpen(!open)}
                style={{ position: 'relative' }}
                aria-label="Notifications"
            >
                <Bell size={18} />
                {count > 0 && (
                    <span 
                        style={{ 
                            position: 'absolute', 
                            top: -2, 
                            right: -2, 
                            background: '#ef4444', 
                            color: 'white', 
                            fontSize: 10, 
                            fontWeight: 800, 
                            minWidth: 16, 
                            height: 16, 
                            borderRadius: 8, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            border: '2px solid var(--bg-card)',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                    >
                        {count}
                    </span>
                )}
            </button>

            {open && (
                <div 
                    className="glass animate-fade-in"
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 12px)',
                        right: 0,
                        width: 360,
                        maxHeight: 480,
                        borderRadius: 16,
                        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                        zIndex: 1000,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        border: '1px solid var(--border-subtle)'
                    }}
                >
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Pending Approvals</h3>
                        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            <X size={18} />
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                        {count === 0 ? (
                            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                                <ShieldCheck size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>All caught up! No pending approvals.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {pendingVerifications.map(j => {
                                    const itemType = j._itemType || 'journey';
                                    const iconColor = itemType === 'fuel' ? '#f59e0b' : itemType === 'expense' ? '#ec4899' : '#8b5cf6';
                                    const IconComp = itemType === 'fuel' ? Droplet : itemType === 'expense' ? Wallet : ShieldCheck;

                                    let title = '';
                                    let subtitle = '';
                                    if (itemType === 'fuel') {
                                        title = 'Fuel Claim';
                                        subtitle = `${j.litres}L · ${truckReg(j.truck)}`;
                                    } else if (itemType === 'expense') {
                                        title = 'Expense Claim';
                                        subtitle = `${fmt(j.amount)} · ${truckReg(j.truck)}`;
                                    } else {
                                        title = j.status === 'Awaiting Start Verification' ? 'Trip Start' : 'Trip Completion';
                                        subtitle = `${j.origin} → ${j.dest}`;
                                    }

                                    return (
                                        <div 
                                            key={j.id}
                                            style={{ 
                                                padding: '12px', 
                                                borderRadius: 12, 
                                                background: 'var(--bg-card-subtle)',
                                                border: '1px solid var(--border-subtle)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 12,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease'
                                            }}
                                            className="hover-card"
                                            onClick={() => {
                                                setVerifyModal(j);
                                                setOpen(false);
                                            }}
                                        >
                                            <div style={{ 
                                                width: 36, 
                                                height: 36, 
                                                borderRadius: 10, 
                                                background: `${iconColor}15`, 
                                                color: iconColor,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                <IconComp size={18} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{title}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>
                                            </div>
                                            <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {count > 0 && (
                        <div style={{ padding: '12px', background: 'var(--bg-main)', borderTop: '1px solid var(--border-subtle)' }}>
                            <Button 
                                variant="secondary" 
                                size="sm" 
                                style={{ width: '100%' }}
                                onClick={() => {
                                    // Could navigate to a dedicated "All Notifications" page if one existed
                                    setOpen(false);
                                }}
                            >
                                View all activity
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
