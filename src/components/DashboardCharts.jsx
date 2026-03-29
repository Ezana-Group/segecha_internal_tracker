import React from "react";

export const Sparkline = ({ data, color, width = 60, height = 24 }) => {
    if (!data || data.length < 2) return null;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const pts = data.map((v, i) => ({
        x: (i / (data.length - 1)) * width,
        y: height - ((v - min) / range) * height
    }));
    const d = `M ${pts.map(p => `${p.x},${p.y}`).join(' L ')}`;
    return (
        <svg width={width} height={height} style={{ overflow: 'visible' }}>
            <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};

export const BarChart = ({ data, dark }) => {
    const max = Math.max(...data.map(d => Math.max(d.rev, d.exp))) || 1;
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 180, padding: '20px 0' }}>
            {data.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, height: '100%' }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                        <div style={{ 
                            width: '40%', 
                            height: `${(d.rev / max) * 100}%`, 
                            background: 'var(--brand-primary)',
                            borderRadius: '2px 2px 0 0',
                            opacity: 0.9,
                            transition: 'height 0.3s ease'
                        }} />
                        <div style={{ 
                            width: '40%', 
                            height: `${(d.exp / max) * 100}%`, 
                            background: 'var(--accent-expense)',
                            borderRadius: '2px 2px 0 0',
                            opacity: 0.9,
                            transition: 'height 0.3s ease'
                        }} />
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>{d.label}</span>
                </div>
            ))}
        </div>
    );
};
