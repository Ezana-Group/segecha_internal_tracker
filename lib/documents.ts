/** Document type labels for vault (insurance, NTSA, COMESA, etc.) */
export const DOC_LABELS: Record<string, string> = {
  insurance_comprehensive: 'Comprehensive Insurance',
  insurance_third_party: 'Third Party Insurance',
  ntsa_inspection: 'NTSA Road Worthiness',
  comesa_certificate: 'COMESA Yellow Card',
  good_transit_licence: 'Good Transit Licence',
  overload_permit: 'Overload / Special Permit',
  route_permit: 'Route Permit',
  customs_bond: 'Customs Bond',
  fire_extinguisher: 'Fire Extinguisher Certificate',
  other_truck: 'Other (Truck)',
  driving_licence: 'Driving Licence',
  psv_badge: 'PSV Badge',
  good_conduct: 'Good Conduct Certificate',
  medical_certificate: 'Medical Fitness',
  nhif: 'NHIF Card',
  nssf: 'NSSF Card',
  other_driver: 'Other (Driver)',
  business_permit: 'Business Permit',
  kra_pin: 'KRA PIN Certificate',
  ntsa_operator: 'NTSA Operator Licence',
  other_company: 'Other (Company)',
}

export function daysAgo(dateStr: string | null | undefined): number {
  if (!dateStr) return 0
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((today.getTime() - d.getTime()) / (24 * 60 * 60 * 1000))
}

export function daysUntil(dateStr: string | null | undefined): number {
  if (!dateStr) return 999
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}
