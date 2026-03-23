import { Component } from 'react';

export class ErrorBoundary extends Component {
    state = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        console.error('Segecha Tracker Error:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: 40, textAlign: 'center' }}>
                    <h2 style={{ color: '#DC2626', marginBottom: 12 }}>Something went wrong</h2>
                    <p style={{ color: '#64748b', marginBottom: 16 }}>This section encountered an error. Other pages are unaffected.</p>
                    <button
                        onClick={() => this.setState({ hasError: false })}
                        style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg, #f97316, #ef4444)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                    >
                        Try Again
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
