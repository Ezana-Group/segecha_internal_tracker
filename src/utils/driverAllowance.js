/**
 * Mileage / driver allowance amount to show for a driver on one journey.
 * Prefers Allowance expenses tagged with driver id, then legacy auto lines
 * ("Driver …" from journey completion), then the journey record field.
 */
export function mileageAllowanceForDriverOnJourney(journey, driverId, expenses = []) {
    if (!journey?.id || !driverId) return 0;
    const list = Array.isArray(expenses) ? expenses : [];
    const isAllowance = (e) => String(e.cat || e.category || "").toLowerCase() === "allowance";

    let sumTagged = 0;
    let sumLegacyDriverLine = 0;
    for (const e of list) {
        if (e.journey !== journey.id || !isAllowance(e)) continue;
        const amt = Number(e.amount || 0);
        if (!amt) continue;
        if (e.driver === driverId) sumTagged += amt;
        else if (!e.driver && journey.driver === driverId && /^Driver\s/i.test(String(e.desc || ""))) {
            sumLegacyDriverLine += amt;
        }
    }
    if (sumTagged > 0) return sumTagged;
    if (sumLegacyDriverLine > 0) return sumLegacyDriverLine;
    return Number(journey.driverMileage || 0);
}
