import { useState, useEffect } from 'react';
import { Search, Package, MapPin, Clock, ArrowRight, ShieldCheck, Box } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'https://api.segecha.com';

const COLORS = {
  primary: '#1B3A6B',
  accent: '#E8501A',
  bg: '#F8FAFC',
  text: '#0F172A',
  textDim: '#64748B',
  green: '#10B981',
  blue: '#3B82F6',
  orange: '#F59E0B'
};

const STEPS = ['Loading', 'In Transit', 'Awaiting Verification', 'Completed'];

export default function TrackApp() {
  const [ref, setRef] = useState('');
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-search if ref is in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRef = params.get('ref');
    if (urlRef) {
      setRef(urlRef);
      handleSearch(urlRef);
    }
  }, []);

  const handleSearch = async (targetRef = ref) => {
    if (!targetRef.trim()) return;
    setLoading(true);
    setError('');
    setShipment(null);

    try {
      const res = await fetch(`${API}/api/track/${targetRef.trim()}`);
      const data = await res.json();
      if (data.success) {
        setShipment(data);
      } else {
        setError(data.error || 'Shipment not found. Please check your reference.');
      }
    } catch {
      setError('Could not connect to tracking service. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStepIndex = (status) => {
    const idx = STEPS.indexOf(status);
    return idx === -1 ? 1 : idx; // Default to 'In Transit' visual if unknown
  };

  return (
    <div style={S.page}>
      {/* Navigation / Logo */}
      <nav style={S.nav}>
        <div style={S.container}>
          <div style={S.logo}>
            <img src="/logo.png" alt="Logo" style={{ height: 40, width: 'auto', objectFit: 'contain' }} />
            <span style={S.logoText}>SEGECHA</span>
            <span style={S.logoSub}>LOGISTICS</span>
          </div>
        </div>
      </nav>

      <main style={S.container}>
        {/* Hero Section */}
        <section style={S.hero}>
          <h1 style={S.heroTitle}>Track your shipment</h1>
          <p style={S.heroSub}>Enter your waybill number or tracking ID to see real-time updates.</p>

          <div style={S.searchBox}>
            <div style={S.inputWrapper}>
              <Search size={20} style={S.searchIcon} color={COLORS.textDim} />
              <input
                style={S.input}
                placeholder="e.g. WB-5432 or JOUR-987"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <button style={S.searchBtn} onClick={() => handleSearch()} disabled={loading}>
              {loading ? 'Searching...' : 'Track'}
            </button>
          </div>
          {error && <div style={S.error}>{error}</div>}
        </section>

        {/* Results Section */}
        {shipment && (
          <div style={S.results}>
            <div style={S.card}>
              <div style={S.cardHeader}>
                <div>
                  <div style={S.overTitle}>WAYBILL NO.</div>
                  <div style={S.waybillNo}>{shipment.waybillNo}</div>
                </div>
                <div style={S.statusBadge(shipment.status)}>
                  {shipment.status}
                </div>
              </div>

              {/* Progress Tracker */}
              <div style={S.tracker}>
                {STEPS.map((step, i) => {
                  const isActive = getStepIndex(shipment.status) >= i;
                  return (
                    <div key={step} style={S.stepItem}>
                      <div style={S.stepLine(i === 0, isActive)} />
                      <div style={S.stepCircle(isActive)}>
                        {isActive && i < getStepIndex(shipment.status) ? <ShieldCheck size={14} /> : i + 1}
                      </div>
                      <div style={S.stepLabel(isActive)}>{step}</div>
                    </div>
                  );
                })}
              </div>

              <div style={S.divider} />

              {/* Shipment Details */}
              <div style={S.detailsGrid}>
                <div style={S.detailItem}>
                  <MapPin size={18} color={COLORS.accent} />
                  <div>
                    <div style={S.detailLabel}>Origin</div>
                    <div style={S.detailVal}>{shipment.origin}</div>
                  </div>
                </div>
                <div style={S.detailItem}>
                  <ArrowRight size={18} color={COLORS.textDim} />
                </div>
                <div style={S.detailItem}>
                  <MapPin size={18} color={COLORS.primary} />
                  <div>
                    <div style={S.detailLabel}>Destination</div>
                    <div style={S.detailVal}>{shipment.dest}</div>
                  </div>
                </div>
              </div>

              <div style={S.divider} />

              <div style={S.footerDetails}>
                <div style={S.fItem}>
                  <Box size={16} color={COLORS.textDim} />
                  <span>Cargo: <b>{shipment.cargo || 'General Goods'}</b></span>
                </div>
                <div style={S.fItem}>
                  <Clock size={16} color={COLORS.textDim} />
                  <span>Last Update: <b>{new Date(shipment.updatedAt).toLocaleDateString()}</b></span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer style={S.siteFooter}>
        <div style={S.container}>
          <p>© {new Date().getFullYear()} Segecha Group Ltd. All rights reserved.</p>
          <div style={S.footerLinks}>
            <a href="https://segecha.com" style={S.fLink}>Landing Page</a>
            <span style={{ opacity: 0.3 }}>|</span>
            <a href="https://app.segecha.com" style={S.fLink}>Admin Login</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    display: 'flex',
    flexDirection: 'column',
  },
  container: {
    width: '100%',
    maxWidth: 800,
    margin: '0 auto',
    padding: '0 24px',
  },
  nav: {
    height: 80,
    display: 'flex',
    alignItems: 'center',
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    marginBottom: 40,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  logoIcon: { fontSize: 24 },
  logoText: { fontSize: 20, fontWeight: 900, color: COLORS.primary, letterSpacing: -0.5 },
  logoSub: { fontSize: 10, fontWeight: 700, color: COLORS.accent, background: '#FFF7ED', padding: '2px 6px', borderRadius: 4 },
  
  hero: {
    textAlign: 'center',
    padding: '40px 0',
  },
  heroTitle: { fontSize: 42, fontWeight: 900, marginBottom: 16, color: COLORS.primary, letterSpacing: -1 },
  heroSub: { fontSize: 18, color: COLORS.textDim, marginBottom: 32, maxWidth: 500, margin: '0 auto 32px' },
  
  searchBox: {
    display: 'flex',
    background: '#fff',
    padding: 8,
    borderRadius: 16,
    boxShadow: '0 10px 25px rgba(27, 58, 107, 0.1)',
    maxWidth: 500,
    margin: '0 auto',
  },
  inputWrapper: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
  },
  input: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: 16,
    padding: '12px 0',
    color: COLORS.text,
    fontWeight: 500,
  },
  searchBtn: {
    background: COLORS.primary,
    color: '#fff',
    border: 'none',
    padding: '0 32px',
    borderRadius: 12,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'transform 0.1s',
  },
  error: { color: COLORS.accent, marginTop: 16, fontSize: 14, fontWeight: 600 },

  results: { marginTop: 40, animation: 'slideUp 0.4s ease-out' },
  card: { background: '#fff', borderRadius: 24, padding: 32, boxShadow: '0 20px 50px rgba(0,0,0,0.05)', border: '1px solid #E2E8F0' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 },
  overTitle: { fontSize: 11, fontWeight: 800, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 },
  waybillNo: { fontSize: 28, fontWeight: 900, color: COLORS.primary },
  statusBadge: (s) => ({
    padding: '6px 14px',
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'uppercase',
    background: s === 'Completed' ? '#ECFDF5' : s === 'In Transit' ? '#EFF6FF' : '#FFF7ED',
    color: s === 'Completed' ? COLORS.green : s === 'In Transit' ? COLORS.blue : COLORS.orange,
    border: `1px solid ${s === 'Completed' ? '#A7F3D0' : s === 'In Transit' ? '#BFDBFE' : '#FFEDD5'}`
  }),

  tracker: { display: 'flex', justifyContent: 'space-between', marginBottom: 40, position: 'relative' },
  stepItem: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 },
  stepLine: (isFirst, active) => ({
    position: 'absolute',
    top: 15,
    left: '-50%',
    width: '100%',
    height: 2,
    background: active ? COLORS.primary : '#E2E8F0',
    display: isFirst ? 'none' : 'block',
    zIndex: -1
  }),
  stepCircle: (active) => ({
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: active ? COLORS.primary : '#fff',
    border: `2px solid ${active ? COLORS.primary : '#E2E8F0'}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: active ? '#fff' : COLORS.textDim,
    fontSize: 12,
    fontWeight: 800,
    marginBottom: 8,
    transition: 'all 0.3s'
  }),
  stepLabel: (active) => ({ fontSize: 11, fontWeight: 700, color: active ? COLORS.primary : COLORS.textDim, textAlign: 'center' }),

  divider: { height: 1, background: '#F1F5F9', margin: '24px 0' },
  detailsGrid: { display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 20 },
  detailItem: { display: 'flex', alignItems: 'center', gap: 12 },
  detailLabel: { fontSize: 11, fontWeight: 700, color: COLORS.textDim, textTransform: 'uppercase' },
  detailVal: { fontSize: 18, fontWeight: 800, color: COLORS.primary },

  footerDetails: { display: 'flex', justifyContent: 'space-between', gap: 20 },
  fItem: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: COLORS.textDim },

  siteFooter: { marginTop: 'auto', padding: '40px 0', borderTop: '1px solid #E2E8F0', textAlign: 'center' },
  footerLinks: { marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontSize: 13 },
  fLink: { color: COLORS.primary, textDecoration: 'none', fontWeight: 600 }
};
