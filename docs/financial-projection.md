# LoanTrack — Cost & Profit Projection

**Scope:** SaaS unit economics for the LoanTrack lending platform, with SMS/WhatsApp cost absorbed by the platform owner (not billed to clients).
**Base scenario:** 50 subscribed clients (tenants), 50 customers (borrowers) each = **2,500 borrowers total**.
**Currency:** INR. **GST:** 18% (collected from client, remitted to govt → pass-through, not platform cost).
**Status:** Projection / planning model. All figures are estimates with stated assumptions.

---

## 1. Pricing (source of truth: `lib/plans.ts`)

| Plan | Monthly (excl GST) | +18% GST | Client pays | Limits (loans / agents / branches) |
|---|---:|---:|---:|---|
| Free | 0 | 0 | 0 | 25 / 1 / 1 |
| **Basic** | **999** | 180 | 1,179 | 200 / 10 / 2 |
| **Business** | **2,999** | 540 | 3,539 | 1,000 / 50 / 5 |
| **Enterprise** | **7,999** | 1,440 | 9,439 | unlimited |

**Add-ons (monthly, `seed-pricing.ts`):** WhatsApp/SMS ₹299 · KYC ₹399 · GPS ₹199 · Premium Accounting ₹599 · Bureau ₹199.

> ⚠️ **DATA BUG — fix before quoting customers.** The catalog seed (`prisma/seed-pricing.ts`) prices Business at **₹1,999** and Enterprise at **₹2,999**, but `lib/plans.ts` prices them at **₹2,999 / ₹7,999**. Two sources disagree → registration pricing and the displayed plan price can diverge. This model uses `plans.ts`. Reconcile the two before relying on revenue numbers.

---

## 2. Cost components

### 2.1 Fixed / shared infrastructure (whole platform, per month)
At 50 tenants / 2,500 borrowers the current 1 vCPU / 3.8 GB VPS is undersized; model assumes an upgrade.

| Item | Monthly |
|---|---:|
| VPS (4 vCPU / 8–16 GB, app + MySQL) | 2,500 |
| Backups / snapshots | 500 |
| Domain + SSL (LE free) | 100 |
| Transactional email / SMTP | 400 |
| Monitoring / misc | 500 |
| **Total fixed** | **4,000** |
| **Per client (÷50)** | **80** |

### 2.2 Payment gateway (variable, per collected subscription)
Razorpay ≈ 2% + 18% GST on fee = **2.36%** of the plan amount.

| Plan | Gateway fee/mo |
|---|---:|
| Basic (999) | 24 |
| Business (2,999) | 71 |
| Enterprise (7,999) | 189 |

### 2.3 SMS / WhatsApp (variable, the key absorbed cost)
Blended **₹0.30 per message** (English ≈ ₹0.20; Tamil/Hindi Unicode ≈ ₹0.50; WhatsApp-first reduces ~40% but requires opt-in). Volume depends entirely on **which events send** and **collection frequency**.

| Intensity | Events / customer / month | SMS/cust/mo | ₹/cust/mo | ₹/client (50) | ₹/2,500 |
|---|---|---:|---:|---:|---:|
| **Light** | statement + 1 reminder + OTP | 3 | 0.90 | 45 | 2,250 |
| **Medium** | weekly confirms + reminders + overdue + OTP | 10 | 3.00 | 150 | 7,500 |
| **Heavy** | **daily** payment-confirm (26) + rest | 35 | 10.50 | 525 | 26,250 |

> **Heavy = the trap.** A daily-collection book that SMSes every payment generates ~65,000 msgs/month for 2,500 borrowers. This single choice is the difference between ₹2k and ₹26k/month.

### 2.4 Per-use API costs (not in core model — recommend charging or one-time)
- **KYC (Digio):** Aadhaar eKYC ≈ ₹3, Video KYC ≈ ₹15–30 — mostly **one-time at onboarding**.
- **Bureau (CIBIL/CRIF):** ≈ ₹50–100 **per pull at loan origination**.
These scale with new loans, not monthly active base. Best billed as metered add-ons, not absorbed.

---

## 3. Per-plan unit economics (1 client, 50 customers, Medium SMS)

| Line | Basic | Business | Enterprise |
|---|---:|---:|---:|
| Net revenue (excl GST) | 999 | 2,999 | 7,999 |
| − Gateway (2.36%) | 24 | 71 | 189 |
| − Infra share | 80 | 80 | 80 |
| − SMS (Medium) | 150 | 150 | 150 |
| **Net profit / client / mo** | **745** | **2,698** | **7,580** |
| **Gross margin** | **75%** | **90%** | **95%** |

> Higher plans permit far more customers (Business 1,000 loans, Enterprise unlimited). SMS is fixed at 50 customers here; real Business/Enterprise tenants will send more SMS, but their revenue rises faster than their SMS cost → margin holds or improves.

---

## 4. Portfolio projections (50 clients)

### 4.1 All clients on Basic
| | Monthly | Annual |
|---|---:|---:|
| Revenue (50 × 999) | 49,950 | 599,400 |
| − Gateway | 1,180 | 14,160 |
| − Infra (fixed) | 4,000 | 48,000 |
| − SMS (Medium, 2,500 × ₹3) | 7,500 | 90,000 |
| **Net profit** | **37,270** | **447,240** |
| **Margin** | **75%** | |

### 4.2 All Basic, but **Heavy** SMS (daily-payment SMS on)
| | Monthly | Annual |
|---|---:|---:|
| Revenue | 49,950 | 599,400 |
| − Gateway + Infra | 5,180 | 62,160 |
| − SMS (Heavy, 2,500 × ₹10.5) | 26,250 | 315,000 |
| **Net profit** | **18,520** | **222,240** |
| **Margin** | **37%** | |

→ Heavy SMS **halves** profit. Same revenue, ₹2.25L/yr extra cost.

### 4.3 Realistic mix (20 Basic / 20 Business / 10 Enterprise), Medium SMS
| | Monthly | Annual |
|---|---:|---:|
| Revenue (19,980 + 59,980 + 79,990) | 159,950 | 1,919,400 |
| − Gateway (2.36%) | 3,775 | 45,300 |
| − Infra (fixed) | 4,000 | 48,000 |
| − SMS (Medium, 2,500 × ₹3) | 7,500 | 90,000 |
| **Net profit** | **144,675** | **1,736,100** |
| **Margin** | **90%** | |

---

## 5. Answer: does ₹999 Basic cover cost?

**Yes, comfortably**, in every SMS profile:

| SMS profile | Cost/client/mo | Profit at ₹999 | Margin |
|---|---:|---:|---:|
| Light | 149 | 850 | 85% |
| Medium | 254 | 745 | 75% |
| Heavy (daily SMS) | 629 | 370 | 37% |

Even the worst case (daily vernacular SMS) leaves **+₹370/client/month**. The risk is not insolvency — it's **margin erosion** from uncapped SMS.

---

## 6. Sensitivity & break-even

- **Break-even on fixed infra (₹4,000/mo):** ~5 Basic clients (Medium SMS). Everything above is profit.
- **SMS is the only variable that bites.** Moving the whole base from Medium→Heavy costs ₹18,750/mo extra (₹2.25L/yr).
- **Customer growth:** SMS cost scales linearly with borrowers, revenue scales with *clients*. A client who grows 50→500 borrowers on the same ₹999 plan can turn negative under Heavy SMS (500 × ₹10.5 = ₹5,250 > ₹999). **Cap borrowers per plan tier** (Basic already caps 200 loans — enforce it).
- **Churn:** every lost client = −₹745–7,580/mo recurring. Retention > acquisition for margin.

---

## 7. Risks

1. **Pricing data bug (§1)** — catalog vs `plans.ts` disagree on Business/Enterprise. Fix first.
2. **Uncapped SMS** — `whatsappSmsEnabled` is a boolean with no quota; one heavy tenant can run up your MSG91 bill invisibly. Meter via existing `NotificationLog`.
3. **OTP abuse** — no rate-limit → OTP bombing inflates your cost. Add per-phone/IP limits.
4. **Per-use APIs (KYC/bureau)** absorbed instead of billed → unbounded at loan-origination volume.
5. **Infra scaling** — single VPS won't hold 50 tenants; budget the upgrade (already in model) and plan DB scaling.
6. **DLT/compliance** — platform is the registered SMS sender; liability + template approval on you.
7. **GST registration** — must be registered to treat GST as pass-through; else it's an 18% revenue hit.

---

## 8. Recommendations

1. **Reconcile plan pricing** (catalog ↔ `plans.ts`) — revenue numbers are only as good as this.
2. **Switch payment-confirmation SMS → daily/weekly digest** (1 msg vs ~26). Collapses Heavy → Medium, protecting margin.
3. **WhatsApp-first** (already coded) — cheaper + free tier; SMS fallback only.
4. **Add per-tenant SMS metering + monthly cap** off `NotificationLog`; alert/charge on overage.
5. **Rate-limit OTP** (e.g., 5/phone/hour).
6. **Meter or one-time KYC/bureau** rather than absorb.
7. **Enforce per-plan borrower caps** so a single ₹999 client can't scale SMS past revenue.
8. **Offer per-tenant sender ID** as a paid upgrade for brand-conscious / high-volume clients.

---

## 9. Headline numbers

| Scenario (50 clients) | Net profit / month | Net profit / year | Margin |
|---|---:|---:|---:|
| All Basic, Medium SMS | ₹37,270 | ₹4.47 L | 75% |
| All Basic, Heavy SMS | ₹18,520 | ₹2.22 L | 37% |
| Mixed (20/20/10), Medium SMS | ₹1,44,675 | ₹17.36 L | 90% |

**Bottom line:** ₹999 Basic is safely profitable with SMS absorbed — *provided* SMS is metered/capped and daily-payment SMS is replaced by a digest. The realistic mixed portfolio nets **~₹17 L/year at 90% margin**. The only thing that breaks the model is uncapped, daily, vernacular SMS.
