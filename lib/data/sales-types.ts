/** Shapes shared by the Odoo sales fetch (server) and the module UI (client). */

export interface SalesLead {
  id: number
  name: string
  /** crm.lead.x_studio_design_poc_1 */
  designer: string
  /** Selection label; the stored designer value remains the stable key. */
  designerLabel?: string
  ecId?: string | null
  referrerName?: string | null
  referredBy?: string | null
  referrerEmail?: string | null
  referrerPhone?: string | null
  referral?: boolean
  /** Owning company in Odoo — every company is included except the excluded few. */
  company: string
  /** crm.lead.source_id name, or null when the lead has no source set. */
  source: string | null
  /** Source is a walk-in / direct one — the denominator for walk-in conversion. */
  walkin: boolean
  stage: string
  /** ISO date, lead creation. */
  created: string
  booked: boolean
  /** ISO date the lead reached the booking stage; null when never booked. */
  bookedOn: string | null
  /** Latest sale.order number, or null when the lead has none. */
  order: string | null
  /** Latest sale.order amount_total. 0 when the lead has no order. */
  amount: number
  /** Archived in Odoo — i.e. lost. */
  lost: boolean
}

export interface SalesSnapshot {
  designers: string[]
  leads: SalesLead[]
  /** Companies the data was compiled from, for the footnote on the page. */
  companies: string[]
  syncedAt: string
  /** Set when the Odoo fetch failed; the page renders the message instead of numbers. */
  error?: string
}
