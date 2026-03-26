import React, { useState } from 'react';
import { COLORS, S } from '../../constants/theme';
import { fmt } from '../../utils/formatters';
import { openWaybillWindow } from '../../utils/waybill';
import { PhotoField } from '../common/PhotoField';

export const JourneyCard = ({
    j,
    truck,
    driver,
    token,
    portalPerm,
    allowUpdate,
    expandedId,
    setExpandedId,
    odomForms,
    setOdom,
    getParty,
    setParty,
    submitTripStart,
    updateStatus,
    customerDirectory,
    fetchDriverData,
    notifyOffice,
    updating,
    msgs,
}) => {
    const isExpanded = expandedId === j.id;
    const [showForm, setShowForm] = useState(false);
    const form = odomForms[j.id] || {};
    const cargoLabel = j.cargo && String(j.cargo).trim() ? `${j.cargo}${j.weight ? ` · ${j.weight}T` : ''}` : 'No cargo specified';
    return (
        <div
            style={{
                background: '#fff',
                borderRadius: 16,
                marginBottom: 14,
                border: `1px solid ${COLORS.border}`,
                boxShadow: '0 2px 14px rgba(15,23,42,.06)',
                overflow: 'hidden',
            }}
        >
            <div
                style={{ padding: 16, cursor: portalPerm.tripExpandDetails !== false ? 'pointer' : 'default' }}
                onClick={() => portalPerm.tripExpandDetails !== false && setExpandedId(isExpanded ? null : j.id)}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                    {portalPerm.tripCardSummary !== false ? (
                        <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.text, lineHeight: 1.25, flex: 1 }}>
                            {j.origin} → {j.dest}
                        </div>
                    ) : (
                        <div style={{ flex: 1 }} />
                    )}
                    <span style={S.badge(j.status)}>{j.status}</span>
                </div>
                {portalPerm.tripCardSummary !== false && <div style={{ fontSize: 13, color: COLORS.textFaint, marginBottom: 10 }}>{j.date || '—'} · {cargoLabel}</div>}
                {portalPerm.tripCardTruckReg !== false && (
                    <div style={{ fontSize: 13, color: COLORS.green, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span aria-hidden>🚛</span>
                        <span>{truck?.reg || '—'}</span>
                    </div>
                )}
                {portalPerm.tripCardMileageLine !== false && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 12, color: COLORS.textFaint, fontWeight: 600 }}>Projected Allowance</span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <span style={{ fontSize: 18, fontWeight: 800, color: COLORS.green }}>{fmt((j.driverMileage || 0) + (j.roadUserAllowance || 0))}</span>
                            <div style={{ fontSize: 10, color: COLORS.textFaint, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                {j.isFlatRate ? 'FLAT RATE' : (j.mileageRateUsed ? `${fmt(j.mileageRateUsed)}/km` : '')}
                                {j.mileageRouteOverride && (
                                    <span style={{ background: COLORS.accent + '15', color: COLORS.accent, padding: '1px 5px', borderRadius: 4, fontSize: 8, fontWeight: 800 }}>ROUTE RATE</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {portalPerm.tripExpandDetails !== false && (
                    <div style={{ fontSize: 11, color: COLORS.textFaint, marginTop: 10, textAlign: 'center', fontWeight: 600 }}>{isExpanded ? '▲ Hide details' : '▼ Tap for trip actions'}</div>
                )}
            </div>

            {isExpanded && portalPerm.tripExpandDetails !== false && (
                <div style={{ borderTop: `1px solid ${COLORS.border}`, padding: 16, background: COLORS.bg }} onClick={(e) => e.stopPropagation()}>
                    {portalPerm.tripDetailAllowanceNote !== false && (
                        <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 12, lineHeight: 1.4 }}>
                            Projected allowance <b>{fmt((j.driverMileage || 0) + (j.roadUserAllowance || 0))}</b> — this represents your income for this trip.
                        </div>
                    )}
                    {portalPerm.tripDetailDistance !== false && (
                        <div style={S.infoRow}>
                            <span style={{ color: COLORS.textFaint }}>Distance</span>
                            <span>{j.distance != null ? `${j.distance} km` : '—'}</span>
                        </div>
                    )}
                    {portalPerm.tripDetailNotes !== false && j.notes && (
                        <div style={S.infoRow}>
                            <span style={{ color: COLORS.textFaint }}>Notes</span>
                            <span style={{ fontSize: 12 }}>{j.notes}</span>
                        </div>
                    )}
                    {portalPerm.tripDetailTrailer !== false && j._trailerReg ? (
                        <div style={S.infoRow}>
                            <span style={{ color: COLORS.textFaint }}>Trailer</span>
                            <span style={{ fontWeight: 700 }}>{j._trailerReg}</span>
                        </div>
                    ) : null}
                    {portalPerm.tripDetailTurnboy !== false && j._turnboyDisplay ? (
                        <div style={S.infoRow}>
                            <span style={{ color: COLORS.textFaint }}>Crew / turnboy</span>
                            <span>{j._turnboyDisplay}</span>
                        </div>
                    ) : null}
                    {portalPerm.tripDetailCustomers !== false && (j._billingCustomerName || j._deliveryCustomerName || j.customerId || j.deliveryCustomerId) && (
                        <>
                            <div style={S.infoRow}>
                                <span style={{ color: COLORS.textFaint }}>Billing customer</span>
                                <span style={{ fontWeight: 600 }}>{j._billingCustomerName || '—'}</span>
                            </div>
                            <div style={S.infoRow}>
                                <span style={{ color: COLORS.textFaint }}>Delivery customer</span>
                                <span style={{ fontWeight: 600 }}>{j._deliveryCustomerName || '—'}</span>
                            </div>
                        </>
                    )}
                    {portalPerm.tripDetailOdomRecorded !== false && j.startOdom && (
                        <div style={S.infoRow}>
                            <span style={{ color: COLORS.textFaint }}>Start Odom</span>
                            <span>{Number(j.startOdom).toLocaleString()} km</span>
                        </div>
                    )}
                    {portalPerm.tripDetailOdomRecorded !== false && j.endOdom && (
                        <div style={S.infoRow}>
                            <span style={{ color: COLORS.textFaint }}>End Odom</span>
                            <span>{Number(j.endOdom).toLocaleString()} km</span>
                        </div>
                    )}

                    {(j.waybillData || j.waybillNo) && portalPerm.tripWaybillButton !== false && (
                        <button
                            type="button"
                            style={{ ...S.btn('ghost'), width: '100%', marginTop: 10, marginBottom: 4, fontSize: 13 }}
                            onClick={(e) => {
                                e.stopPropagation();
                                openWaybillWindow(j, truck?.reg);
                            }}
                        >
                            📄 View / print waybill
                        </button>
                    )}

                    {allowUpdate && (j.status === 'Loading' || j.status === 'Approved' || j.status === 'In Transit') && (
                        !showForm ? (
                            <button style={{ ...S.btn('blue'), width: '100%', marginTop: 14 }} onClick={(e) => { e.stopPropagation(); setShowForm(true); }}>
                                {j.status === 'Loading' ? '+ Log Trip Start' : j.status === 'Approved' ? 'Start Trip' : '+ Log Arrival / End Trip'}
                            </button>
                        ) : (
                        <div style={{ marginTop: 14, padding: 14, background: '#fff', borderRadius: 12, border: `1px solid ${COLORS.border}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <h3 style={{ margin: 0, fontSize: 16, color: COLORS.text }}>
                                    {j.status === 'Loading' ? 'Log Trip Start' : 'Log Arrival / End Trip'}
                                </h3>
                                <button style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: COLORS.textFaint }} onClick={(e) => { e.stopPropagation(); setShowForm(false); }}>✕</button>
                            </div>
                            
                            {portalPerm.tripRejectionNotice !== false && j._rejectionReason && (
                                <div style={{ ...S.errBox(), marginBottom: 12, fontWeight: 700 }}>
                                    ⚠️ REJECTED: {j._rejectionReason}
                                    <div style={{ fontWeight: 400, marginTop: 4, fontSize: 11 }}>
                                        The office has flagged the sections in red for correction. Please review and re-submit.
                                    </div>
                                </div>
                            )}

                            {j.status === 'Loading' && portalPerm.tripCustomersBeforeDepart !== false && (
                                <>
                                    <div style={{ 
                                        padding: (j._rejectedFields || []).includes('customers') ? 10 : 0,
                                        borderRadius: 10,
                                        border: (j._rejectedFields || []).includes('customers') ? `2px solid ${COLORS.red}` : 'none',
                                        marginBottom: (j._rejectedFields || []).includes('customers') ? 16 : 0,
                                        background: (j._rejectedFields || []).includes('customers') ? '#fff1f2' : 'transparent'
                                    }}>
                                        <div style={{ fontWeight: 800, color: COLORS.text, marginBottom: 10, fontSize: 14 }}>📍 Stage 1 — Customer Information</div>
                                        <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 12, lineHeight: 1.45 }}>
                                            Who is paying (billing) and who receives the goods (delivery).
                                        </div>

                                        <label style={S.lbl}>Billing type</label>
                                        <select style={S.inp} value={getParty(j).billType} onClick={(e) => e.stopPropagation()} onChange={(e) => setParty(j, { billType: e.target.value })}>
                                            <option value="Company">Company</option>
                                            <option value="Individual">Individual</option>
                                        </select>

                                        <label style={S.lbl}>Billing customer</label>
                                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                            <button
                                                type="button"
                                                style={{ ...S.btn('ghost'), flex: 1, fontSize: 12, padding: '8px 10px', opacity: getParty(j).useNewBill ? 0.5 : 1 }}
                                                onClick={(e) => { e.stopPropagation(); setParty(j, { useNewBill: false }); }}
                                            >
                                                From list
                                            </button>
                                            <button
                                                type="button"
                                                style={{ ...S.btn('ghost'), flex: 1, fontSize: 12, padding: '8px 10px', opacity: getParty(j).useNewBill ? 1 : 0.5 }}
                                                onClick={(e) => { e.stopPropagation(); setParty(j, { useNewBill: true }); }}
                                            >
                                                New customer
                                            </button>
                                        </div>
                                        {!getParty(j).useNewBill ? (
                                            <select style={S.inp} value={getParty(j).customerId} onClick={(e) => e.stopPropagation()} onChange={(e) => setParty(j, { customerId: e.target.value })}>
                                                <option value="">Select…</option>
                                                {customerDirectory.map((c) => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <>
                                                <input
                                                    style={S.inp}
                                                    placeholder="Company or person name"
                                                    value={getParty(j).newBillName}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={(e) => setParty(j, { newBillName: e.target.value })}
                                                />
                                                <input
                                                    style={S.inp}
                                                    placeholder="Phone (optional)"
                                                    inputMode="tel"
                                                    value={getParty(j).newBillPhone}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={(e) => setParty(j, { newBillPhone: e.target.value })}
                                                />
                                                {getParty(j).billType === 'Company' && (
                                                    <input
                                                        style={S.inp}
                                                        placeholder="Email (required for companies)"
                                                        type="email"
                                                        value={getParty(j).newBillEmail}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onChange={(e) => setParty(j, { newBillEmail: e.target.value })}
                                                    />
                                                )}
                                            </>
                                        )}

                                        <label style={S.lbl}>Delivery type</label>
                                        <select style={S.inp} value={getParty(j).delType} onClick={(e) => e.stopPropagation()} onChange={(e) => setParty(j, { delType: e.target.value })}>
                                            <option value="Company">Company</option>
                                            <option value="Individual">Individual</option>
                                        </select>

                                        <label style={{ ...S.lbl, marginTop: 12 }}>Delivery customer</label>
                                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                            <button
                                                type="button"
                                                style={{ ...S.btn('ghost'), flex: 1, fontSize: 12, padding: '8px 10px', opacity: getParty(j).useNewDel ? 0.5 : 1 }}
                                                onClick={(e) => { e.stopPropagation(); setParty(j, { useNewDel: false }); }}
                                            >
                                                From list
                                            </button>
                                            <button
                                                type="button"
                                                style={{ ...S.btn('ghost'), flex: 1, fontSize: 12, padding: '8px 10px', opacity: getParty(j).useNewDel ? 1 : 0.5 }}
                                                onClick={(e) => { e.stopPropagation(); setParty(j, { useNewDel: true }); }}
                                            >
                                                New customer
                                            </button>
                                        </div>
                                        {!getParty(j).useNewDel ? (
                                            <select style={S.inp} value={getParty(j).deliveryCustomerId} onClick={(e) => e.stopPropagation()} onChange={(e) => setParty(j, { deliveryCustomerId: e.target.value })}>
                                                <option value="">Select…</option>
                                                {customerDirectory.map((c) => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <>
                                                <input
                                                    style={S.inp}
                                                    placeholder="Receiver name or site"
                                                    value={getParty(j).newDelName}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={(e) => setParty(j, { newDelName: e.target.value })}
                                                />
                                                <input
                                                    style={S.inp}
                                                    placeholder="Phone (optional)"
                                                    inputMode="tel"
                                                    value={getParty(j).newDelPhone}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={(e) => setParty(j, { newDelPhone: e.target.value })}
                                                />
                                            </>
                                        )}
                                    </div>

                                    <div style={{ marginTop: 24, marginBottom: 10, height: 1, background: COLORS.border }} />

                                    <div style={{ 
                                        padding: (j._rejectedFields || []).includes('tripDetails') ? 10 : 0,
                                        borderRadius: 10,
                                        border: (j._rejectedFields || []).includes('tripDetails') ? `2px solid ${COLORS.red}` : 'none',
                                        marginBottom: (j._rejectedFields || []).includes('tripDetails') ? 16 : 0,
                                        background: (j._rejectedFields || []).includes('tripDetails') ? '#fff1f2' : 'transparent'
                                    }}>
                                        <div style={{ fontWeight: 800, color: COLORS.text, marginBottom: 10, fontSize: 14 }}>📍 Stage 2 — Trip Details</div>

                                        <label style={S.lbl}>Origin</label>
                                        <input style={S.inp} placeholder="e.g. Nairobi" value={form.origin ?? j.origin ?? ''} onChange={(e) => setOdom(j.id, 'origin', e.target.value)} />

                                        <label style={S.lbl}>Destination</label>
                                        <input style={S.inp} placeholder="e.g. Mombasa" value={form.dest ?? j.dest ?? ''} onChange={(e) => setOdom(j.id, 'dest', e.target.value)} />

                                        <label style={S.lbl}>Cargo Description</label>
                                        <input style={S.inp} placeholder="e.g. Electronics" value={form.cargo ?? j.cargo ?? ''} onChange={(e) => setOdom(j.id, 'cargo', e.target.value)} />

                                        <label style={S.lbl}>Weight (Tonnes)</label>
                                        <input style={S.inp} type="number" inputMode="decimal" placeholder="e.g. 5.5" value={form.weight ?? j.weight ?? ''} onChange={(e) => setOdom(j.id, 'weight', e.target.value)} />

                                        <label style={S.lbl}>Notes</label>
                                        <input style={S.inp} placeholder="Optional notes for the office" value={form.notes ?? j.notes ?? ''} onChange={(e) => setOdom(j.id, 'notes', e.target.value)} />
                                    </div>

                                    {portalPerm.tripStartOdomPhotos !== false && (
                                        <div style={{ 
                                            padding: (j._rejectedFields || []).includes('odometer') ? 10 : 0,
                                            borderRadius: 10,
                                            border: (j._rejectedFields || []).includes('odometer') ? `2px solid ${COLORS.red}` : 'none',
                                            background: (j._rejectedFields || []).includes('odometer') ? '#fff1f2' : 'transparent',
                                            marginTop: 12
                                        }}>
                                            <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 12, fontSize: 13, marginTop: 12 }}>📍 Record your start odometer</div>
                                            <label style={S.lbl}>Start Odometer Reading (km)</label>
                                            <input
                                                style={S.inp}
                                                type="number"
                                                placeholder="e.g. 142300"
                                                value={form.startOdom ?? j.startOdom ?? ''}
                                                onChange={(e) => setOdom(j.id, 'startOdom', e.target.value)}
                                            />
                                            <PhotoField
                                                label="📷 Photo of Odometer"
                                                hint="Take a clear photo of the dashboard odometer reading"
                                                token={token}
                                                folder="odometer"
                                                filename={`${j.id}_start`}
                                                onUploaded={(url) => setOdom(j.id, 'startOdomPhotoUrl', url)}
                                            />
                                        </div>
                                    )}

                                    {msgs[j.id] && <div style={{ color: msgs[j.id].startsWith('✅') ? COLORS.green : COLORS.red, fontSize: 12, marginBottom: 10, marginTop: 10 }}>{msgs[j.id]}</div>}

                                    {portalPerm.tripMarkInTransit !== false && (
                                        <button
                                            style={{ ...S.btn('blue'), width: '100%', marginTop: 20 }}
                                            disabled={updating[j.id]}
                                            onClick={() => submitTripStart(j)}
                                        >
                                            {updating[j.id] ? '⏳ Submitting…' : '🛡️ Submit Trip for Office Approval'}
                                        </button>
                                    )}
                                </>
                            )}

                            {j.status === 'In Transit' && portalPerm.tripEndOdomAndProof !== false && (
                                <>
                                    <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 12, fontSize: 13 }}>🏁 On arrival — record your end odometer and upload delivery proof</div>
                                    <div style={{ 
                                        padding: (j._rejectedFields || []).includes('endOdometer') ? 10 : 0,
                                        borderRadius: 10,
                                        border: (j._rejectedFields || []).includes('endOdometer') ? `2px solid ${COLORS.red}` : 'none',
                                        background: (j._rejectedFields || []).includes('endOdometer') ? '#fff1f2' : 'transparent',
                                        marginBottom: 16
                                    }}>
                                        <label style={S.lbl}>End Odometer Reading (km)</label>
                                        <input
                                            style={S.inp}
                                            type="number"
                                            placeholder="e.g. 142300"
                                            value={form.endOdom ?? j.endOdom ?? ''}
                                            onChange={(e) => setOdom(j.id, 'endOdom', e.target.value)}
                                        />
                                        <PhotoField
                                            label="📷 Final Odometer Photo"
                                            hint="Take photo of odometer at destination"
                                            token={token}
                                            folder="odometer"
                                            filename={`${j.id}_end`}
                                            onUploaded={(url) => setOdom(j.id, 'endOdomPhotoUrl', url)}
                                        />
                                    </div>
                                    
                                    <div style={{ 
                                        padding: (j._rejectedFields || []).includes('deliveryProof') ? 10 : 0,
                                        borderRadius: 10,
                                        border: (j._rejectedFields || []).includes('deliveryProof') ? `2px solid ${COLORS.red}` : 'none',
                                        background: (j._rejectedFields || []).includes('deliveryProof') ? '#fff1f2' : 'transparent',
                                        marginBottom: 16
                                    }}>
                                        <PhotoField
                                            label="📄 Delivery Proof / Waybill"
                                            hint="Photo of signed delivery note or waybill"
                                            token={token}
                                            folder="delivery"
                                            filename={`${j.id}_proof`}
                                            onUploaded={(url) => setOdom(j.id, 'deliveryProofUrl', url)}
                                        />
                                    </div>

                                    {msgs[j.id] && <div style={{ color: msgs[j.id].startsWith('✅') ? COLORS.green : COLORS.red, fontSize: 12, marginBottom: 10 }}>{msgs[j.id]}</div>}

                                    <button
                                        style={{ ...S.btn('green'), width: '100%', marginTop: 10 }}
                                        disabled={updating[j.id]}
                                        onClick={() => updateStatus(j, 'Awaiting Verification')}
                                    >
                                        {updating[j.id] ? '⏳ Submitting…' : '🏁 Mark Journey Completed'}
                                    </button>
                                </>
                            )}
                            {j.status === 'Approved' && (
                                <>
                                    <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 12, fontSize: 13 }}>🚀 Trip Approved! Update your current status:</div>
                                    <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                                        <button
                                            style={{ ...S.btn('ghost'), flex: 1 }}
                                            disabled={updating[j.id]}
                                            onClick={() => updateStatus(j, 'Loading')}
                                        >
                                            Stay Loading
                                        </button>
                                        <button
                                            style={{ ...S.btn('green'), flex: 1 }}
                                            disabled={updating[j.id]}
                                            onClick={() => updateStatus(j, 'In Transit')}
                                        >
                                            Start Trip
                                        </button>
                                    </div>
                                    {msgs[j.id] && <div style={{ color: msgs[j.id].startsWith('✅') ? COLORS.green : COLORS.red, fontSize: 12, marginTop: 10 }}>{msgs[j.id]}</div>}
                                </>
                            )}
                        </div>
                        )
                    )}

                    {j.status === 'Approved' && (
                        <div style={{ marginTop: 14, padding: 14, background: '#f0fdf4', border: '1px dashed #22c55e', borderRadius: 10, textAlign: 'center' }}>
                            <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
                            <div style={{ fontWeight: 700, color: '#16a34a', fontSize: 14 }}>Trip Start Approved</div>
                            <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 4 }}>
                                The office has approved your start details. You can now mark the trip as **In Transit** when you depart.
                            </div>
                        </div>
                    )}

                    {j.status === 'Awaiting Start Verification' && portalPerm.tripAwaitingBanner !== false && (
                        <div style={{ marginTop: 14, padding: 14, background: '#fff7ed', border: '1px dashed #fb923c', borderRadius: 10, textAlign: 'center' }}>
                            <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
                            <div style={{ fontWeight: 700, color: '#f97316', fontSize: 14 }}>Awaiting Office Start Approval</div>
                            <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 4 }}>
                                Your trip start details have been sent. The office will review your odometer photo and customer details shortly.
                            </div>
                            <button style={{ ...S.btn('ghost'), marginTop: 12, width: '100%' }} onClick={() => fetchDriverData(token)}>
                                Refresh Status
                            </button>
                        </div>
                    )}

                    {j.status === 'Awaiting Verification' && portalPerm.tripAwaitingBanner !== false && (
                        <div style={{ marginTop: 14, padding: 14, background: COLORS.blue + '10', border: `1px dashed ${COLORS.blue}`, borderRadius: 10, textAlign: 'center' }}>
                            <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
                            <div style={{ fontWeight: 700, color: COLORS.blue, fontSize: 14 }}>Awaiting Office Verification</div>
                            <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 4 }}>
                                Your arrival details have been sent. The office will review your odometer reading and delivery proof shortly.
                            </div>
                            <button style={{ ...S.btn('ghost'), marginTop: 12, width: '100%' }} onClick={() => fetchDriverData(token)}>
                                Refresh Status
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
