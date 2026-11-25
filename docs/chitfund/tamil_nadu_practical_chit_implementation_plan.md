# Implementation Plan: Practical Tamil Nadu Unorganized Chit Models (`loanapp`)

This plan translates the real-world chit fund practices discussed in the field recording into an engineering blueprint for `loanapp`. It focuses on **zero-bloat, practical local workflows**—stripping away unused enterprise options (like Sealed Tender) from default views and adding the exact calculation, commission, auction edge-case, and 25-day shopkeeper collection rules used on the ground.

---

## 1. Core Chit Models Identified from Field Requirements

The audio highlights **4 distinct operational patterns** that must be supported as first-class presets in `loanapp`:

### Preset 1: Friends / Family Circle — Foreman Free 1st Chit (Zero Commission)
* **How it works:** The organizer starts a group (e.g., ₹1,00,000 pot, 10 members, ₹10,000/month) and takes the **1st cycle's full pot (₹1,00,000)** with **no auction** and **0% commission** for the entire tenure. The organizer's benefit is getting an interest-free lump sum on Day 1.
* **Auction starts:** Cycle 2 onwards.
* **Repayment Rule (Prized Pays Full, Non-Prized Splits Remainder):**
  * Everyone who has **already lifted** (including the foreman from Cycle 1) **AND the current cycle's winner** pay the full base instalment (₹10,000).
  * Only the remaining **non-prized** members share the discount benefit.
* **Worked Example (from Audio):**
  * Pot $V = ₹1,00,000$, Members $N = 10$, Base Instalment $S = ₹10,000$.
  * **Cycle 1:** Foreman takes ₹1,00,000. All 10 pay ₹10,000.
  * **Cycle 2:** Winner bids ₹15,000 discount $\implies$ Payout $P_2 = ₹85,000$.
    * Prized members paying full (Foreman + Cycle 2 Winner = 2 members): $2 \times ₹10,000 = ₹20,000$.
    * Balance needed from remaining 8 non-prized members: $₹85,000 - ₹20,000 = ₹65,000$.
    * Each non-prized member pays: $\frac{₹65,000}{8} = ₹8,125$ (saving ₹1,875 each).
  * **Cycle 3:** 3 members (Foreman + Cycle 2 + Cycle 3 winners) pay full ₹10,000; remaining 7 non-prized members split the balance.

### Preset 2: Business / Agent Chit — Additive Commission Model
* **How it works:** Run commercially by an agent/foreman. Auctions start from **Cycle 1** (the agent does not take a free 1st pot).
* **Commission Structure (2 Modes):**
  1. **Percentage of Pot:** Standard $4\%$–$5\%$ of $V$ (used in larger ₹5L–₹10L+ chits).
  2. **Additive Per-Member Fee (Crucial Local Rule):** Instead of deducting commission from the pot/discount, the agent first divides the payout amount among members and then **adds a flat fee per member** (e.g., ₹100 or ₹200 per member).
* **Worked Example (from Audio):**
  * Pot $V = ₹1,00,000$, $N = 10$, Discount $D = ₹15,000 \implies$ Payout $P = ₹85,000$.
  * Base split across all 10 members = $\frac{₹85,000}{10} = ₹8,500$.
  * Agent adds ₹200/member $\implies$ Each member pays **$₹8,700$**.
  * Total collected = $₹87,000$ ($₹85,000$ paid to winner + $₹2,000$ agent income).
* **Dividend Distribution Toggle (2 Variants):**
  * **Variant A — Non-Prized Only (*Edutha Commission Illai*):** Prized members pay full base ($₹10,000 + \text{agent fee}$); only non-prized members get the discount.
  * **Variant B — All Members (*Eduthalum Commission, Edukkalainalum Commission*):** Both prized and non-prized members pay the exact same discounted instalment ($₹8,500 + ₹200 = ₹8,700$).

### Preset 3: Daily Shopkeeper 25-Day Rolling Chit (*Kadai / Thandal Chit*)
* **How it works:** Designed specifically for retail shopkeepers and market traders.
* **Collection Cycle:** Field agent visits every shop **daily** and collects a fixed sum (e.g., ₹1,000/day).
* **25-Day Rolling Window:** Every **25 collection days** (not calendar months) equals 1 full chit cycle (e.g., $₹1,000 \times 25 = ₹25,000$ per member).
* **Auction & Ledger Adjustment:** On Day 25, an auction is held. Because shopkeepers have already paid the full ₹25,000 via daily collections, the auction dividend is handled via a **Carry-Forward / Adjustment Ledger** (*Kuraikkanuma / Ethhanuma*):
  * **Option 1 (Day-Skip Credit):** Credit the dividend (e.g., ₹3,000) to the member's wallet so they skip 3 days of ₹1,000 collection in the next 25-day cycle.
  * **Option 2 (Daily Rate Adjustment):** Lower the daily collection amount for the next 25 days (e.g., $\frac{₹25,000 - ₹3,000}{25} = ₹880/\text{day}$).
  * **Option 3 (Cash Payout / Settle):** Refund the dividend in cash at the end of the 25-day cycle.

---

## 2. Exact Mathematical Engine Specifications

Let:
* $V$ = Total Chit Value
* $N$ = Total Members / Cycles
* $S = \frac{V}{N}$ = Base Instalment
* $t$ = Current Cycle ($1 \le t \le N$)
* $D_t$ = Winning Discount in Cycle $t$
* $P_t = V - D_t$ = Net Prize Payout to Winner
* $f_{\text{mem}}$ = Additive Flat Agent Fee per member (e.g., ₹200)
* $c$ = Percentage Commission Rate (e.g., $0.05$)

### Formula A: Non-Prized Only Split (Current Winner Pays Full — Audio Concept 1)
Let $k_t$ be the number of prized members **including** the cycle $t$ winner (normally $k_t = t$):
* **Prized Member Payable:**
  $$\text{Due}_{\text{prized}, t} = S + f_{\text{mem}}$$
* **Non-Prized Member Payable ($N - k_t$ members):**
  $$\text{Due}_{\text{non-prized}, t} = \frac{P_t - (k_t \cdot S)}{N - k_t} + f_{\text{mem}} = \left(S - \frac{D_t}{N - k_t}\right) + f_{\text{mem}}$$
*(Guardrail: In the final cycle $t = N$, $N - k_t = 0$, so everyone pays $S + f_{\text{mem}}$ and the last member receives $V - D_{\min}$.)*

### Formula B: All-Members Equal Split with Additive Agent Fee (Audio Concept 2)
* **Every Member Payable (Prized & Non-Prized):**
  $$\text{Due}_{\text{all}, t} = \frac{P_t}{N} + f_{\text{mem}}$$
* **Agent Income:**
  $$\text{AgentFee}_t = N \cdot f_{\text{mem}}$$

### Formula C: Standard Percentage Commission Mode (For Large Chits ₹5L+)
* **Agent Income:**
  $$\text{AgentFee}_t = c \cdot V$$
* **Distributable Dividend:**
  $$\text{DivPool}_t = \max(0, D_t - c \cdot V)$$
* Split $\text{DivPool}_t$ across either $N$ (All Members) or $N - k_t$ (Non-Prized Only).

---

## 3. Critical Real-World Auction Edge Cases (State Machine)

The audio emphasizes two exact scenarios where naive chit software breaks in real life. `loanapp` must handle both automatically:

### Edge Case 1: High-Demand Cap $\rightarrow$ Auto-Switch to Lottery (*Kulakkal*)
* **Scenario:** During festival seasons (e.g., Deepavali), 3+ members desperately need cash and keep bidding the payout down ($₹80,000 \rightarrow ₹60,000 \rightarrow ₹55,000 \rightarrow ₹50,000$). Dropping below $50\%$ hurts everyone.
* **System Behavior:**
  1. Configure `max_discount_pct` (e.g., $40\%$ or $50\%$, meaning minimum payout = $₹50,000$).
  2. When live bidding reaches the cap and $\ge 2$ members accept the capped payout, the app **locks bidding** and displays: *"Maximum discount limit reached. Switching to Lottery Draw."*
  3. Foreman selects the willing tied bidders and taps **Run Lottery (*Kulakkal*)** to randomly pick the winner at the capped payout.

### Edge Case 2: Final 1–2 Cycles No-Bid $\rightarrow$ Minimum Floor + Lottery
* **Scenario:** In Month 9 or 10 (out of 10), remaining members refuse to bid any discount because they know they will get the full ₹1,00,000 soon anyway.
* **System Behavior:**
  1. Configure `min_bid_amount` (e.g., ₹2,000 or ₹5,000) or `min_bid_pct` (e.g., $2\%$).
  2. If an auction receives **zero bids** (typically in cycles $t = N-1$ or $t = N$), the app triggers **No-Bid Resolution**:
     * Automatically applies `min_bid_amount` (e.g., ₹2,000) as the cycle deduction.
     * Runs a **Lottery (*Kulakkal*)** among all remaining non-prized members.
     * Deducts `min_bid_amount` from the payout ($₹1,00,000 - ₹2,000 = ₹98,000$) and distributes/credits the ₹2,000 per group rules.

```text
[AUCTION_OPEN]
   ├── Bid received < Max Cap ──► Continue Bidding ──► [WINNER_CONFIRMED]
   ├── Multiple bids HIT Max Cap ──► Lock Bidding ──► [TIE_BREAKER_LOTTERY] ──► [WINNER_CONFIRMED]
   └── Zero bids (Final Cycles) ──► Apply Min Bid Floor ──► [NO_BID_LOTTERY] ──► [WINNER_CONFIRMED]
```

---

## 4. Schema & Configuration Updates for `loanapp`

Add these fields to your existing `ChitGroup` / `ChitScheme` model (keeping backward compatibility with existing schemes):

```json
{
  "preset_template": "FRIENDS_FREE_FIRST | AGENT_BUSINESS | SHOPKEEPER_25DAY_DAILY | CUSTOM",
  "selection_modes_enabled": ["OPEN_AUCTION", "LOTTERY_KULAKKAL", "FIXED_TICKET_ORDER"],
  "hide_unused_modes": ["SEALED_TENDER"],
  "foreman_rules": {
    "free_first_chit": true,
    "foreman_member_id": "usr_001",
    "commission_mode": "NONE | ADDITIVE_PER_MEMBER | PERCENTAGE_OF_POT",
    "additive_fee_per_member": 200,
    "commission_pct": 5.0
  },
  "dividend_rules": {
    "distribution_mode": "NON_PRIZED_ONLY | ALL_MEMBERS",
    "current_winner_pays_full": true
  },
  "auction_guardrails": {
    "max_discount_pct": 50,
    "max_cap_tie_action": "AUTO_LOTTERY_AMONG_TIED",
    "min_bid_amount": 2000,
    "no_bid_action": "APPLY_MIN_BID_AND_LOTTERY"
  },
  "rolling_daily_config": {
    "enabled": true,
    "daily_collection_amount": 1000,
    "days_per_cycle": 25,
    "dividend_adjustment_mode": "WALLET_DAY_SKIP | REDUCE_NEXT_DAILY_RATE | CASH_REFUND"
  }
}
```

---

## 5. Phased Implementation Checklist

### Phase 1: Preset Templates & Clean UI
- [ ] Add **3 One-Click Group Templates** on the "Create Chit" screen:
  1. *Friends / Family Chit (Free 1st Pot, Zero Commission)*
  2. *Business / Agent Chit (Per-Member Fee or % Commission)*
  3. *Shopkeeper Daily Chit (25-Day Rolling Cycle)*
- [ ] Hide **Sealed Tender** behind an "Advanced Settings" toggle so local organizers only see *Open Auction*, *Lottery (Kulakkal)*, and *Fixed Order*.

### Phase 2: Calculation Engine Updates
- [ ] Implement the `current_winner_pays_full` flag inside the `NON_PRIZED_ONLY` dividend calculator so the math matches Cycle 2 ($2$ full payers, $8$ split payers) and Cycle 3 ($3$ full payers, $7$ split payers) exactly.
- [ ] Implement `ADDITIVE_PER_MEMBER` commission mode (adds ₹100/₹200 on top of each member's payable without reducing the winner's payout).
- [ ] Add a live **"Preview Instalment Breakdown"** card on the auction screen showing: *Winner Payout*, *Prized Member Due*, *Non-Prized Member Due*, and *Agent Earning* before confirming the auction.

### Phase 3: Auction Guardrails (Cap & No-Bid Lotteries)
- [ ] Enforce `max_discount_pct` in the live auction screen with a one-tap **"Cap Reached $\rightarrow$ Pick by Lottery"** modal.
- [ ] Add a **"No Bidders $\rightarrow$ Run Min-Bid Lottery"** button for the final 1–2 cycles that automatically deducts `min_bid_amount` (e.g., ₹2,000) and draws from remaining non-prized members.

### Phase 4: 25-Day Shopkeeper Daily Collection Module
- [ ] Add `ROLLING_25_DAY` to the frequency selector alongside Daily, Weekly, Bi-Weekly, and Monthly.
- [ ] Build the **Shopkeeper Daily Passbook & Route Sheet**:
  * Track daily ₹1,000 entries (`Day 1` to `Day 25`).
  * Trigger auction reminder automatically when Cycle Day 25 completes.
  * Auto-post post-auction dividend into the member's **Adjustment Balance** (allowing the agent to choose *Skip Next X Days*, *Adjust Daily Rate*, or *Refund Cash*).