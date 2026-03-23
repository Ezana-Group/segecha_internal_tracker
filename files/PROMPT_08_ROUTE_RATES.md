-e ---
# SEGECHA — CURSOR SESSION 8 OF 8
# Previous: PROMPT_07_FUEL_TURNBOY.md
# Next: — (complete)
# Scope: src/App.jsx + driver-portal/src/App.jsx
# Rule: Complete every section and run the checklist before closing this session.
---

# Segecha — Route-Specific Mileage Rate Overrides
# Cursor AI Patch — apply after CURSOR_FUEL_TURNBOY_MILEAGE.md

This patch adds the ability for admin to set different KES/km mileage rates
per route. For example Nairobi→Kampala can pay KES 15/km while Nairobi→Mombasa
pays KES 10/km. The system automatically applies the route override when a
journey is logged — falling back to the default rate if no override exists.

---

## CHANGE 1 — Add route override constants at top of `App.jsx`

Find:
```js
const DRIVER_PER_KM = _S.driverPerKm ? +_S.driverPerKm : 10;
const TURNBOY_PER_KM = _S.turnboyPerKm ? +_S.turnboyPerKm : 6;
```

Replace with:
```js
const DRIVER_PER_KM = _S.driverPerKm ? +_S.driverPerKm : 10;
const TURNBOY_PER_KM = _S.turnboyPerKm ? +_S.turnboyPerKm : 6;
const ROUTE_OVERRIDES = _S.routeOverrides || {}; // { "Nairobi→Kampala": { driver: 15, turnboy: 9 } }

// Helper: get the effective rate for a given route
const getEffectiveRates = (origin, dest) => {
    if (!origin || !dest) return { driver: DRIVER_PER_KM, turnboy: TURNBOY_PER_KM };
    const key = `${origin.trim()}→${dest.trim()}`;
    const reverseKey = `${dest.trim()}→${origin.trim()}`;
    const override = ROUTE_OVERRIDES[key] || ROUTE_OVERRIDES[reverseKey];
    return {
        driver: override?.driver ?? DRIVER_PER_KM,
        turnboy: override?.turnboy ?? TURNBOY_PER_KM,
        isOverride: !!override,
        routeKey: key,
    };
};
```

---

## CHANGE 2 — Update journey modal to use route-aware rates

Find inside the journey modal the mileage preview block:
```jsx
{form.distance && (
    <div style={{ ...S.fg, gridColumn: "1/-1" }}>
        <div style={{ background: dark ? '#10b98108' : '#f0fdf4', ...
```

Replace the entire mileage preview block with:
```jsx
{form.distance && (
    <div style={{ ...S.fg, gridColumn: "1/-1" }}>
        {(() => {
            const rates = getEffectiveRates(form.origin, form.dest);
            const dist = +form.distance || 0;
            return (
                <div style={{ background: dark ? '#10b98108' : '#f0fdf4', border: '1px solid #10b98133', borderRadius: 8, padding: '12px 16px' }}>
                    <div style={{ fontWeight: 700, color: T.text, fontSize: 12, marginBottom: 8 }}>
                        🛣️ Mileage Allowance Preview ({dist} km)
                        {rates.isOverride && (
                            <span style={{ marginLeft: 8, background: '#f97316', color: '#fff', borderRadius: 10, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>
                                Route rate applied
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 20, fontSize: 13, flexWrap: 'wrap' }}>
                        <div>
                            <span style={{ color: T.textFaint }}>Driver: </span>
                            <b style={{ color: '#10b981' }}>{fmt(Math.round(dist * rates.driver))}</b>
                            <span style={{ color: T.textFaint, fontSize: 11 }}> @ KES {rates.driver}/km</span>
                        </div>
                        {(form.turnboyId || form.turnboyName) && (
                            <div>
                                <span style={{ color: T.textFaint }}>Turnboy: </span>
                                <b style={{ color: '#3b82f6' }}>{fmt(Math.round(dist * rates.turnboy))}</b>
                                <span style={{ color: T.textFaint, fontSize: 11 }}> @ KES {rates.turnboy}/km</span>
                            </div>
                        )}
                    </div>
                    {rates.isOverride && (
                        <div style={{ fontSize: 11, color: '#f97316', marginTop: 6 }}>
                            Using route-specific rate for {rates.routeKey}. Default rates: driver KES {DRIVER_PER_KM}/km, turnboy KES {TURNBOY_PER_KM}/km.
                        </div>
                    )}
                    {!rates.isOverride && (
                        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 6 }}>
                            Using default rates. Set route-specific rates in Settings → Mileage Rates.
                        </div>
                    )}
                    <div style={{ fontSize: 11, color: T.textFaint, marginTop: 4 }}>
                        These will be auto-created as Allowance expense entries when you save.
                    </div>
                </div>
            );
        })()}
    </div>
)}
```

---

## CHANGE 3 — Update journey save handler to use route-aware rates

Find inside the journey modal `onSave` the mileage calculation:
```js
const driverMileage = Math.round(dist * DRIVER_PER_KM);
const turnboyMileage = form.turnboyId || form.turnboyName
    ? Math.round(dist * TURNBOY_PER_KM)
    : 0;
const enrichedForm = {
    ...form,
    driverMileage,
    turnboyMileage,
    mileageRateUsed: DRIVER_PER_KM,
    turnboyMileageRateUsed: TURNBOY_PER_KM,
};
```

Replace with:
```js
const rates = getEffectiveRates(form.origin, form.dest);
const driverMileage = Math.round(dist * rates.driver);
const turnboyMileage = (form.turnboyId || form.turnboyName)
    ? Math.round(dist * rates.turnboy)
    : 0;
const enrichedForm = {
    ...form,
    driverMileage,
    turnboyMileage,
    mileageRateUsed: rates.driver,
    turnboyMileageRateUsed: rates.turnboy,
    mileageRouteOverride: rates.isOverride,
};
```

Also update the auto-expense descriptions to show the actual rate used:
```js
// Driver allowance expense desc:
desc: `Driver mileage allowance — ${form.origin} → ${form.dest} (${dist} km @ KES ${rates.driver}/km)`,

// Turnboy allowance expense desc:
desc: `Turnboy mileage allowance (${tbName}) — ${form.origin} → ${form.dest} (${dist} km @ KES ${rates.turnboy}/km)`,
```

---

## CHANGE 4 — Add route override state to Settings component

Find the mileage rate state variables added in the previous file:
```js
const [driverPerKm, setDriverPerKm] = useState(...);
const [turnboyPerKm, setTurnboyPerKm] = useState(...);
```

After them, add:
```js
const [routeOverridesText, setRouteOverridesText] = useState(() => {
    try {
        const s = JSON.parse(localStorage.getItem('segecha_settings') || '{}');
        const overrides = s.routeOverrides || {};
        if (Object.keys(overrides).length === 0) return '';
        return Object.entries(overrides)
            .map(([route, rates]) => `${route},${rates.driver},${rates.turnboy}`)
            .join('
');
    } catch { return ''; }
});
```

---

## CHANGE 5 — Add route overrides to saveSettings

Find inside `saveSettings` where `driverPerKm, turnboyPerKm` are saved. Add:

```js
// Parse route overrides from text
const routeOverrides = {};
if (routeOverridesText.trim()) {
    routeOverridesText.split('
').forEach(line => {
        const parts = line.split(',').map(p => p.trim());
        // Format: "Origin→Dest,driverRate,turnboyRate"
        if (parts.length >= 3) {
            const route = parts[0];
            const dRate = +parts[1];
            const tRate = +parts[2];
            if (route && dRate > 0) {
                routeOverrides[route] = { driver: dRate, turnboy: tRate || 0 };
            }
        }
    });
}
```

Then add `routeOverrides` to the settings object `s`:
```js
const s = {
    // ... existing fields ...
    driverPerKm, turnboyPerKm,
    routeOverrides,   // ← add this
    // ... rest of fields ...
};
```

---

## CHANGE 6 — Add route override UI to Settings page

Find the mileage rates card in the Settings component. After the `turnboyPerKm` row and the example calculation box, add:

```jsx
<div style={{ marginTop: 14 }}>
    <div style={{ fontWeight: 700, color: T.text, fontSize: 13, marginBottom: 8 }}>
        Route-Specific Rate Overrides
    </div>
    <div style={{ fontSize: 12, color: T.textDim, marginBottom: 8, lineHeight: 1.6 }}>
        Set different rates for specific routes. One route per line in this format:<br />
        <code style={{ background: dark ? '#1c2235' : '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>
            Origin→Destination, DriverKES/km, TurnboyKES/km
        </code>
    </div>
    <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 8 }}>
        Examples:<br />
        <code style={{ fontSize: 11 }}>Nairobi→Kampala,15,9</code><br />
        <code style={{ fontSize: 11 }}>Nairobi→Dar es Salaam,18,11</code><br />
        <code style={{ fontSize: 11 }}>Mombasa→Kampala,16,10</code>
    </div>
    <textarea
        style={{ ...S.inp, height: 130, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
        placeholder={'Nairobi→Kampala,15,9
Nairobi→Dar es Salaam,18,11
Mombasa→Kampala,16,10'}
        value={routeOverridesText}
        onChange={e => setRouteOverridesText(e.target.value)}
    />
    {/* Live parse preview */}
    {routeOverridesText.trim() && (
        <div style={{ background: dark ? '#0c0e14' : '#f8fafc', borderRadius: 8, padding: '10px 14px', marginTop: 8, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 11, color: T.textFaint, fontWeight: 700, marginBottom: 6 }}>Preview — parsed overrides:</div>
            {routeOverridesText.split('
').filter(l => l.trim()).map((line, i) => {
                const parts = line.split(',').map(p => p.trim());
                const valid = parts.length >= 2 && parts[0] && +parts[1] > 0;
                return (
                    <div key={i} style={{ fontSize: 12, marginBottom: 3, color: valid ? T.textDim : '#ef4444' }}>
                        {valid
                            ? <>✅ <b>{parts[0]}</b> — Driver: KES {parts[1]}/km{parts[2] ? `, Turnboy: KES ${parts[2]}/km` : ''}</>
                            : <>❌ Invalid line: "{line}" — use format: Route,DriverRate,TurnboyRate</>
                        }
                    </div>
                );
            })}
        </div>
    )}
</div>
```

---

## CHANGE 7 — Show route override badge on journey table rows

Find the journey table Mileage column cell added in the previous file:
```jsx
<td style={S.td}>
    {j.driverMileage ? (
        <div>
            <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>D: {fmt(j.driverMileage)}</div>
            {j.turnboyMileage > 0 && <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 700 }}>T: {fmt(j.turnboyMileage)}</div>}
        </div>
    ) : <span style={{ color: T.textFaint }}>—</span>}
</td>
```

Replace with:
```jsx
<td style={S.td}>
    {j.driverMileage ? (
        <div>
            <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>
                D: {fmt(j.driverMileage)}
                {j.mileageRateUsed && <span style={{ color: T.textFaint, fontWeight: 400 }}> @{j.mileageRateUsed}</span>}
            </div>
            {j.turnboyMileage > 0 && (
                <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 700 }}>
                    T: {fmt(j.turnboyMileage)}
                    {j.turnboyMileageRateUsed && <span style={{ color: T.textFaint, fontWeight: 400 }}> @{j.turnboyMileageRateUsed}</span>}
                </div>
            )}
            {j.mileageRouteOverride && (
                <div style={{ fontSize: 9, color: '#f97316', fontWeight: 700, marginTop: 2 }}>ROUTE RATE</div>
            )}
        </div>
    ) : <span style={{ color: T.textFaint }}>—</span>}
</td>
```

---

## CHANGE 8 — Show route rate on driver portal per journey

Find inside the driver portal `JourneyCard` the mileage allowance row:
```jsx
{j.driverMileage > 0 && (
    <div style={S.infoRow}>
        <span style={{ color: COLORS.textFaint }}>Your Mileage Allowance</span>
        <span style={{ color: COLORS.green, fontWeight: 700 }}>
            {`KES ${Number(j.driverMileage).toLocaleString('en-KE')}`}
            <span style={{ fontSize: 11, color: COLORS.textFaint, fontWeight: 400, marginLeft: 4 }}>
                ({j.distance} km @ KES {j.mileageRateUsed}/km)
            </span>
        </span>
    </div>
)}
```

Replace with:
```jsx
{j.driverMileage > 0 && (
    <div style={S.infoRow}>
        <span style={{ color: COLORS.textFaint }}>Your Mileage Allowance</span>
        <span style={{ color: COLORS.green, fontWeight: 700 }}>
            {`KES ${Number(j.driverMileage).toLocaleString('en-KE')}`}
            <span style={{ fontSize: 11, color: COLORS.textFaint, fontWeight: 400, marginLeft: 4 }}>
                ({j.distance} km @ KES {j.mileageRateUsed}/km
                {j.mileageRouteOverride ? ' — route rate' : ' — standard rate'})
            </span>
        </span>
    </div>
)}
```

---

## CHANGE 9 — Settings example calculation uses route overrides

Find inside the Settings mileage card the example calculation box:
```jsx
<div style={{ fontSize: 13, color: T.text }}>
    Nairobi → Mombasa (480 km)<br />
    Driver: <b style={{ color: '#10b981' }}>KES {(+driverPerKm * 480).toLocaleString('en-KE')}</b>
    ...
</div>
```

Replace with a dynamic example that checks if a route override exists:
```jsx
{(() => {
    const exampleRoutes = [
        { origin: 'Nairobi', dest: 'Mombasa', dist: 480 },
        { origin: 'Nairobi', dest: 'Kampala', dist: 680 },
    ];
    return exampleRoutes.map(r => {
        const routeKey = `${r.origin}→${r.dest}`;
        const parsedOverrides = {};
        routeOverridesText.split('
').filter(l => l.trim()).forEach(line => {
            const parts = line.split(',').map(p => p.trim());
            if (parts.length >= 2 && parts[0] && +parts[1] > 0) {
                parsedOverrides[parts[0]] = { driver: +parts[1], turnboy: +parts[2] || 0 };
            }
        });
        const override = parsedOverrides[routeKey];
        const dRate = override?.driver ?? +driverPerKm;
        const tRate = override?.turnboy ?? +turnboyPerKm;
        return (
            <div key={routeKey} style={{ fontSize: 13, color: T.text, marginBottom: 6 }}>
                {r.origin} → {r.dest} ({r.dist} km)
                {override && <span style={{ background: '#f97316', color: '#fff', borderRadius: 8, padding: '1px 6px', fontSize: 10, marginLeft: 6, fontWeight: 700 }}>route rate</span>}
                <br />
                <span style={{ fontSize: 12 }}>
                    Driver: <b style={{ color: '#10b981' }}>KES {(dRate * r.dist).toLocaleString('en-KE')}</b>
                    {+turnboyPerKm > 0 && <> · Turnboy: <b style={{ color: '#3b82f6' }}>KES {(tRate * r.dist).toLocaleString('en-KE')}</b></>}
                </span>
            </div>
        );
    });
})()}
```

---

## How route overrides work end to end

**Admin sets up:**
```
Nairobi→Kampala, 15, 9
Nairobi→Dar es Salaam, 18, 11
Mombasa→Kampala, 16, 10
```

**When journey is logged:**
- System calls `getEffectiveRates("Nairobi", "Kampala")`
- Finds override: driver = 15, turnboy = 9
- Calculates: 680 km × 15 = KES 10,200 for driver
- Calculates: 680 km × 9 = KES 6,120 for turnboy
- Auto-creates two Allowance expense entries with these amounts
- Stores `mileageRateUsed: 15`, `mileageRouteOverride: true` on the journey

**For Nairobi→Mombasa (no override):**
- Falls back to default: driver KES 10/km, turnboy KES 6/km
- 480 km × 10 = KES 4,800 driver, 480 km × 6 = KES 2,880 turnboy
- Stores `mileageRouteOverride: false`

**Journey table** shows the actual rate used per trip with a "ROUTE RATE" badge where applicable.

**Driver portal** shows *(route rate)* vs *(standard rate)* so driver knows which applied.

## Updated full apply order

| # | File |
|---|---|
| 1 | `CURSOR_FULL_PROMPT.md` |
| 2 | `CURSOR_PAYMENT_FULL.md` |
| 3 | `CURSOR_DRIVER_PORTAL.md` |
| 4 | `CURSOR_DRIVER_ADDENDUM.md` |
| 5 | `CURSOR_DOCUMENTS_R2.md` |
| 6 | `CURSOR_JOURNEY_VERIFICATION.md` |
| 7 | `CURSOR_FUEL_TURNBOY_MILEAGE.md` |
| 8 | `CURSOR_ROUTE_MILEAGE_RATES.md` ← this file |
