# Comprehensive Chit Fund Types & Procedures Specification (India / Tamil Nadu)

This document defines the complete taxonomy of organized and unorganized chit fund models across India (with deep coverage of Tamil Nadu, Kerala, Andhra Pradesh/Telangana, Karnataka, and North/West India), designed to extend the chit and loan engine in **`loanapp`**.

---

## 1. Master Taxonomy of Chit Fund Types

To support everything from ₹100 daily market micro-chits to ₹2 Crore+ enterprise syndicates, the application should support **17 distinct chit engines** grouped into 4 categories.

### Category A: Bidding & Auction Engines

| Code | Chit Type | Local / Regional Names | How It Works |
| :--- | :--- | :--- | :--- |
| `AUCTION_STANDARD` | **Standard Auction Dividend Chit** | *Yela Chit* (TN), *Paata* (AP/TS), *Lelam* (KL), *Committee* (North) | Non-prized members bid a discount each cycle. Highest discount wins the pot; discount minus foreman commission is shared as dividend. Supports **Open**, **Sealed/Tender**, and **Online** bidding. |
| `AUCTION_RESERVE_PRICE` | **Reserve-Price / Declining Floor Chit** | *Sarkari Ghaata* Committee (Delhi / UP / North India) | An auction chit with a mandatory minimum starting bid (reserve price) that decreases linearly each cycle as fewer instalments remain. If nobody bids above the floor, the pot is allotted by lottery at the reserve price. |
| `AUCTION_MULTI_DIVISION` | **Multi-Division Chit** | *Multidivision Chitty* (Kerala / KSFE model) | Large group split into sub-divisions (typically 4 winners per cycle): **1 lottery winner** gets the full chit value minus foreman commission, and **3 auction winners** bid competitively. Total discounts from all auctions are pooled and split equally among all subscribers. |
| `AUCTION_UNCAPPED_ENTERPRISE` | **Uncapped / High-Value Syndicate Chit** | *Business Committee*, *Bishi* (MH/GJ), *Enterprise Yela Chit* | High-value (₹25L–₹2Cr+) trader/developer pool with no statutory 30%–40% discount cap (or custom cap), backed by strict collateral (PDCs, pro-notes, property docs) and short-term foreman float rules. |

---

### Category B: Fixed, Chart & Non-Auction Engines

| Code | Chit Type | Local / Regional Names | How It Works |
| :--- | :--- | :--- | :--- |
| `BASE_PLUS_PREMIUM` | **Base + Premium (Differential Instalment) Chit** | *Theni Draw-of-Lots*, *Interest-Bearing Chit*, *Prized-Premium Chit* (TN/AP/KA) | Members pay a **Base Instalment** ($S_{\text{base}}$) until they win/lift the chit. After winning, they pay **Base + Premium** ($S_{\text{base}} + P$) for all remaining cycles. Payout follows a pre-defined escalating chart or fixed pot. Very popular in Tamil Nadu (e.g., 21-month plans: ₹5,000 before lifting, ₹6,000 after lifting). |
| `FIXED_CHART_ESCALATING` | **Fixed Payment / Escalating Payout (Chart Chit)** | *Table Chit*, *Chart Chit*, *Fixed-Rate Chit* | Every member pays the exact same fixed instalment every cycle. No bidding occurs. The winner (chosen by lottery or consensus) receives a pre-printed payout that increases month-by-month (e.g., Month 1 gets ₹82,000; Month 20 gets ₹1,15,000). |
| `FIXED_DIVIDEND` | **Fixed Dividend Chit** | *Pre-Fixed Dividend Scheme* | A fixed dividend schedule is published on Day 1 (higher dividend in early cycles, tapering to zero in final cycles). Monthly net payable changes predictably without live auctions. Winner is chosen by lottery or capped draw. |
| `FIXED_PAYOUT_VARIABLE_PAY` | **Fixed Payout / Variable Payment Chit** | *Full-Pot Chit* | The recipient **always** receives 100% of the gross chit value (after optional commission). Monthly subscriptions vary across cycles or between prized and non-prized members to balance the pool. |
| `PURE_LOTTERY` | **Pure Lottery Chit** | *Kulakkal Chit* (TN), *Narukku Kuri* (KL) | Zero bidding, zero variable dividend. All non-prized names are drawn from a box/RNG each cycle. Winner receives the full pot (or pot minus a flat foreman fee). |
| `FIXED_ROTATION` | **Fixed-Order Rotation Chit** | *Murai Chit* (TN), *Office / Friends ROSCA* | The exact payout sequence for all $N$ cycles is finalized on Day 1 (by draw or mutual agreement). Zero bidding, zero commission, zero dividend. |
| `NEED_BASED_CONSENSUS` | **Need-Based / Consensus Chit** | *Community / Family Trust Chit* | No formal auction or lottery. Each cycle, members meet and mutually agree to allocate the pot to the member with the most urgent need (medical, education, wedding). |

---

### Category C: Micro, Commodity & Purpose-Driven Engines

| Code | Chit Type | Local / Regional Names | How It Works |
| :--- | :--- | :--- | :--- |
| `MICRO_DAILY_COLLECTION` | **Daily / 25-Day Cycle Micro-Chit** | *Thandal Chit*, *Sandhai / Market Chit* (Erode, Tiruppur, Coimbatore, Madurai) | Field agents collect small daily sums (e.g., ₹40–₹800/day over a 25-day or 30-day collection cycle) or weekly sums from street vendors and auto drivers. Draws/auctions happen weekly or monthly. |
| `GOLD_VALUE_ACCUMULATION` | **Gold / Jewellery Value Chit** | *11+1 Gold Scheme*, *Nagai Chit* (TN/KL/KA) | Members pay a fixed cash instalment for $N$ months (typically 11 months). At maturity, the jeweller adds a bonus (e.g., 1 month free or zero making/wastage charges) and redeems in gold jewellery at prevailing market rates. |
| `GOLD_WEIGHT_ACCUMULATION` | **Gold Weight-Accumulation Chit** | *DigiGold / Gram-Locked Chit* | Each daily/weekly/monthly payment immediately converts into grams of gold at that day's bullion rate ($g_t = S / R_t$). At maturity, the member redeems total accumulated grams without cash refund. |
| `FESTIVAL_COMMODITY` | **Festival / Commodity / Goods Chit** | *Deepavali Chit*, *Pongal Chit*, *Vessel / Grocery / Cracker Chit* | Fixed weekly/monthly cash contributions for 10–12 months. Payout is delivered **in kind** (gold coin, sweets, crackers, brassware, groceries, or home appliances) rather than cash, often with a merchant bonus. |

---

### Category D: Enterprise, Hybrid & Lending-Linked Engines

| Code | Chit Type | Local / Regional Names | How It Works |
| :--- | :--- | :--- | :--- |
| `HYBRID_SPLIT_PHASE` | **Hybrid / Split-Phase Chit** | *Foreman-First / Pre-Booked Auction Chit* | Cycles $1$ to $k$ (typically 1–3) are reserved at a pre-fixed discount for the foreman or urgent early-need members. Cycles $k+1$ to $N$ run as a standard competitive auction. |
| `ASCA_SHG_REVOLVING` | **ASCA / SHG Revolving Pool** | *Kudumbashree* (KL), *Mahalir Thittam* (TN), *Sangha Fund* | Unlike a ROSCA (where 1 person takes the entire pot), contributions accumulate in a common fund. Multiple members can borrow **partial loans** from the pool at an agreed monthly interest rate. At cycle end (e.g., 12 months), principal + interest profit is distributed equally. |
| `CUSTOM_MANUAL_SCHEDULE` | **Custom / Manual Schedule Chit** | *Bespoke / Notebook Chit* | Allows the foreman to manually enter or upload a CSV/table specifying exact `instalment_non_prized`, `instalment_prized`, `payout_amount`, and `commission` for every single cycle $t \in [1, N]$. |

---

## 2. Core Mathematical Formulas for Calculation Engine

Let:
- $V$ = Total Chit Value (Pot Size)
- $N$ = Total Number of Cycles / Tickets (e.g., 20 months)
- $S = \frac{V}{N}$ = Base Instalment per full ticket
- $t$ = Current Cycle Number ($1 \le t \le N$)
- $c$ = Foreman Commission Rate (e.g., $0.05$ for 5%, $0.07$ for 7% under Chit Funds Amendment Act 2019)
- $C = c \cdot V$ = Foreman Commission Amount per cycle
- $D_t$ = Winning Bid Discount in cycle $t$
- $u_i$ = Ticket Units held by member $i$ (supports fractional/split tickets like $0.5$, $1.0$, $2.0$)

### 2.1 Standard Auction Dividend (`AUCTION_STANDARD`)
- **Prize Payout to Winner:**
  $$P_t = V - D_t$$
- **Distributable Dividend Pool:**
  $$\text{DivPool}_t = \max(0, D_t - C)$$
- **Dividend Per Full Ticket (Mode 1: Split Among All Members):**
  $$d_t = \frac{\text{DivPool}_t}{N}$$
  $$\text{NetDue}_{i,t} = u_i \cdot (S - d_t)$$
- **Dividend Per Full Ticket (Mode 2: Non-Prized Members Only):**
  Let $N_{\text{np}, t}$ be the count of non-prized tickets eligible in cycle $t$:
  $$d_t = \frac{\text{DivPool}_t}{N_{\text{np}, t}}$$
  $$\text{NetDue}_{i,t} = \begin{cases} u_i \cdot S & \text{if member } i \text{ is already prized} \\ u_i \cdot (S - d_t) & \text{if member } i \text{ is non-prized} \end{cases}$$

### 2.2 Reserve-Price Auction (`AUCTION_RESERVE_PRICE` / *Sarkari Ghaata*)
Let $x$ be the reserve percentage per remaining cycle (typically $1\%$ to $3\%$):
- **Minimum Floor Bid in Cycle $t$:**
  $$R_t = (x \cdot V) \cdot (N - t + 1)$$
- Any valid bid $D_t$ must satisfy $D_t \ge R_t$. If no member bids above $R_t$, winner is chosen by lottery at $D_t = R_t$.

### 2.3 Multi-Division Chit (`AUCTION_MULTI_DIVISION`)
For a cycle $t$ with $1$ lottery winner and $M$ auction winners (e.g., $M = 3$) across $N_{\text{total}}$ total tickets:
- **Lottery Winner Payout:**
  $$P_{\text{lot}, t} = V - C$$
- **Auction Winner $j$ Payout ($j = 1 \dots M$):**
  $$P_{\text{auc}, j, t} = V - D_{j, t}$$
- **Pooled Dividend Per Ticket:**
  $$d_t = \frac{\sum_{j=1}^{M} (D_{j, t} - C)}{N_{\text{total}}}$$

### 2.4 Base + Premium Chit (`BASE_PLUS_PREMIUM`)
Let $P_{\text{prem}}$ be the fixed post-prize premium added per cycle after lifting:
- **Member Due in Cycle $t$:**
  $$\text{NetDue}_{i,t} = \begin{cases} u_i \cdot S_{\text{base}} & \text{if non-prized} \\ u_i \cdot (S_{\text{base}} + P_{\text{prem}}) & \text{if prized in any cycle } < t \end{cases}$$
- **Total Pool Collected in Cycle $t$** (assuming $k_t$ tickets already prized):
  $$\text{Collected}_t = (N \cdot S_{\text{base}}) + (k_t \cdot P_{\text{prem}})$$

### 2.5 Gold Weight-Accumulation (`GOLD_WEIGHT_ACCUMULATION`)
For instalment $S_t$ paid on date $t$ when the gold rate per gram is $R_t$:
- **Grams Credited in Cycle $t$:**
  $$g_t = \frac{S_t}{R_t}$$
- **Total Redeemable Gold Weight at Maturity:**
  $$G_{\text{total}} = \sum_{t=1}^{N} g_t$$

### 2.6 ASCA / SHG Revolving Pool (`ASCA_SHG_REVOLVING`)
Let $I_{\text{total}}$ be total interest earned from internal member loans during the term, and $E_{\text{admin}}$ be group expenses:
- **End-of-Term Payout Per Member:**
  $$\text{Share}_i = \left(\sum_{t=1}^{N} S_{i,t}\right) + \frac{u_i}{\sum u_j} \cdot (I_{\text{total}} - E_{\text{admin}})$$

---

## 3. Cross-Cutting Operational Rules & Modifiers

Rather than hardcoding every combination, configure these orthogonal flags on each Chit Group entity in `loanapp`:

### A. Collection Frequency & Tenure
- `DAILY_25`: 25 collection days per month (standard in TN market chits; skips Sundays/holidays)
- `DAILY_30`: Calendar daily collection
- `WEEKLY`: 4 or 5 collections per month (e.g., every Sunday/Wednesday *sandhai* day)
- `FORTNIGHTLY`: Every 15 days
- `MONTHLY`: Standard 10, 12, 15, 20, 21, 25, 30, 40, 50, 60, or 120 months
- `BI_MONTHLY`: Every 2 months (common in enterprise chits)
- `SEASONAL_HARVEST`: Irregular dates aligned to agricultural harvest cycles

### B. Ticket Sharing & Multi-Units
- Support `ticket_units` as a decimal (`0.25`, `0.5`, `1.0`, `2.0`, etc.).
- Two members holding `0.5` each share one `ticket_number`, split dues 50/50, and split prize payouts 50/50.

### C. Foreman Compensation Models
- `PERCENTAGE_COMMISSION`: Standard 5%–7% of $V$ deducted every cycle.
- `FREE_TICKET_CYCLE_1` / `FREE_TICKET_CYCLE_2`: Foreman takes the 1st or 2nd cycle's full pot with $0$ discount (extremely common in unorganized Tamil Nadu chits).
- `FLAT_FEE`: Fixed ₹ amount per cycle (common in micro/lottery chits).
- `HYBRID`: Free ticket in Cycle 1/2 **plus** reduced percentage commission (e.g., 2%–3%) in remaining cycles.
- `ZERO_COMMISSION`: Mutual/friends/SHG groups.

### D. Dividend Distribution Modes
- `ALL_MEMBERS`: Equal split across all $N$ tickets.
- `NON_PRIZED_ONLY`: Split only among members who have not yet lifted.
- `DEFERRED_BONUS_POOL`: Everyone pays full $S$; dividends accumulate and pay out as a lump-sum bonus at maturity or boost final-cycle payouts.
- `NONE`: Pure lottery, fixed rotation, or commodity chits.

### E. Tie-Breaker & Default Policies
- **Tie-Breaker (Multiple Max-Cap Bids):** `LOTTERY_DRAW` (statutory default under Chit Funds Act 1982), `EARLIEST_TIMESTAMP`, or `MANUAL_FOREMAN_PICK`.
- **Penalty on Late Payment:** Flat daily fine (e.g., ₹50/day), percentage penal interest (e.g., 12%–24% p.a.), or **Dividend Forfeiture** (defaulting member loses that cycle's dividend share).
- **Security / Collateral Types (for Prized Subscribers):** `NONE`, `INTERNAL_GUARANTOR_JAMEEN`, `PROMISSORY_NOTE`, `POST_DATED_CHEQUE`, `GOLD_PLEDGE`, `PROPERTY_DOCUMENT`, `FD_LIEN`.
- **Default Substitution:** Allow swapping a non-prized defaulter with a `SUBSTITUTE_MEMBER` (configurable cutoff, e.g., disallowed after 70% tenure completion).

---

## 4. Suggested Schema Extension for `loanapp`

Below is a reference configuration schema (JSON / TypeScript-friendly) that can map cleanly to your database models (`ChitGroup` / `ChitScheme`):

```json
{
  "chit_type": "AUCTION_STANDARD | AUCTION_RESERVE_PRICE | AUCTION_MULTI_DIVISION | AUCTION_UNCAPPED_ENTERPRISE | BASE_PLUS_PREMIUM | FIXED_CHART_ESCALATING | FIXED_DIVIDEND | FIXED_PAYOUT_VARIABLE_PAY | PURE_LOTTERY | FIXED_ROTATION | NEED_BASED_CONSENSUS | MICRO_DAILY_COLLECTION | GOLD_VALUE_ACCUMULATION | GOLD_WEIGHT_ACCUMULATION | FESTIVAL_COMMODITY | HYBRID_SPLIT_PHASE | ASCA_SHG_REVOLVING | CUSTOM_MANUAL_SCHEDULE",
  "regulatory_tier": "REGISTERED_ACT_1982 | UNORGANIZED_INFORMAL | SHG_COOPERATIVE | MERCHANT_SAVINGS",
  "scale_tier": "MICRO | HOUSEHOLD | SME_TRADER | ENTERPRISE",
  "collection_frequency": "DAILY_25 | DAILY_30 | WEEKLY | FORTNIGHTLY | MONTHLY | BI_MONTHLY | SEASONAL_HARVEST",
  "payout_asset_type": "CASH | GOLD_WEIGHT | GOLD_VALUE | COMMODITY_GOODS",
  "bidding_mode": "OPEN_LIVE | SEALED_TENDER | ONLINE_APP | NONE",
  "discount_rules": {
    "min_discount_pct": 0,
    "max_discount_pct": 40,
    "uncapped": false,
    "reserve_price_step_pct": 0,
    "bid_increment_multiple": 100
  },
  "dividend_distribution": "ALL_MEMBERS | NON_PRIZED_ONLY | DEFERRED_BONUS_POOL | NONE",
  "foreman_compensation": {
    "mode": "PERCENTAGE_COMMISSION | FREE_TICKET_CYCLE_1 | FREE_TICKET_CYCLE_2 | FLAT_FEE | HYBRID | ZERO_COMMISSION",
    "commission_pct": 5.0,
    "flat_fee_amount": 0,
    "reserved_foreman_cycles": []
  },
  "differential_instalment": {
    "enabled": false,
    "base_instalment": 5000,
    "prized_premium_amount": 1000
  },
  "multi_division": {
    "enabled": false,
    "lottery_winners_per_cycle": 1,
    "auction_winners_per_cycle": 3
  },
  "security_requirements": {
    "required_for_prized": true,
    "accepted_types": ["INTERNAL_GUARANTOR_JAMEEN", "PROMISSORY_NOTE", "POST_DATED_CHEQUE"],
    "auto_hold_payout_until_verified": true
  },
  "default_rules": {
    "forfeit_dividend_on_late": true,
    "late_fee_type": "FLAT_PER_DAY | PERCENTAGE_PA | NONE",
    "late_fee_value": 12.0,
    "substitution_cutoff_pct": 70
  }
}
```

---

## 5. High-Value Integration Hooks for a Combined Loan + Chit App

Since `loanapp` manages **both loans and chits**, adding these cross-module workflows unlocks real-world Indian finance operations:

1. **Chit-Backed Bridge Loan (Against Non-Prized Ticket):**
   - Allow a non-prized subscriber to take a short-term loan up to $50\%$–$80\%$ of their paid-in chit balance, using their chit passbook/ticket as collateral (`CHIT_LIEN`).
2. **Auto-Settlement from Chit Payout:**
   - When a member wins a chit auction/draw, automatically detect any active loans or overdue EMIs in `loanapp` and offer a one-click **Net-Off Disbursement** (deduct overdue loan principal/interest before releasing the remaining prize money).
3. **Internal Guarantor (*Jameen*) Lock:**
   - If Member A stands as guarantor for Member B's prized chit or loan, lock Member A's non-prized chit payout in the system until Member B clears their remaining instalments.
4. **Daily Collection Agent Route Sheet (Micro Chits + Daily Loans):**
   - Combine daily loan EMIs (*Thandal* / micro-loans) and `MICRO_DAILY_COLLECTION` chit dues into a single unified agent collection sheet per customer, generating one combined UPI/cash receipt.