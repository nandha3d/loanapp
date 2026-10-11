# Google Play submission pack — ZoloFund (v1, micro-lending)

Fill the Play Console from this file. Every answer matches what the **Play build**
(`PLAY_RELEASE=true`, see ENGINEERING_REFERENCE §15.1) actually does and what
zolofunds.com/privacy says. If the app changes, update the privacy page first,
then this file, then the Console.

Developer: **Animazon** (sole proprietorship of Nandhakumar Ganesan),
Udyam UDYAM-TN-07-0135439, 155 Animazon, Narayana Valasu, Nasiyanur Road,
Erode 638011, Tamil Nadu. Contact: support@zolofunds.com · +91 80894 05950.

---

## 0. Before you start

- [ ] **Organisation** developer account named exactly **Animazon** (not the personal
      `animazondigital@gmail.com` account — Google requires organisation accounts for
      financial-services apps). D-U-N-S number for Animazon requested and verified.
- [ ] Contact email on the domain: `support@zolofunds.com`. Website: `https://zolofunds.com`.
- [ ] Rotate the `noreply@zolofunds.com` mailbox password (it was in git history) and
      update `SMTP_PASS` on the VPS.
- [ ] Demo tenant for reviewers (see §6) created and loaded with sample data.
- [ ] Bundle built by CI: *Actions → Build Android APK → Run workflow → play_bundle ✓*.
      Download artifact `zolofund-play-aab` → `app-release.aab`. Enrol in **Play App
      Signing**; the CI keystore is the *upload* key.

## 1. App details

| Field | Value |
|---|---|
| App name (≤30) | `ZoloFund for Lending Staff` |
| Default language | English (India) |
| App or game | App |
| Free or paid | Free |
| Category | **Business** |
| Tags | Business, Productivity |
| Contact email | support@zolofunds.com |
| Website | https://zolofunds.com |
| Privacy policy URL | https://zolofunds.com/privacy |

**Short description (≤80):**
`Field collection and loan-book app for staff of registered lending businesses.`

**Full description:**

```
ZoloFund is lending-operations software for the staff of registered lending
businesses — owners, branch managers and field collection agents. It is a
business tool: ZoloFund does NOT offer, arrange or advertise loans to the public.

Accounts are created by your organisation's administrator. To use the app,
your business must already use Zolo Funds.

For field agents
• Today's collection route and customer list
• Record collections (cash, UPI) with a GPS stamp and instant receipt
• Works offline and syncs when you are back online
• Customer photos and KYC documents from the camera
• Voice entry of names and amounts (audio is never stored)
• Fingerprint / face app lock

For owners and branch managers
• Live dashboard of collections and overdue accounts
• Approve agent-registered customers and corrections (maker-checker)
• Track agents' collection routes while they are working
• Reports in 6 languages: English, Tamil, Hindi, Telugu, Kannada, Malayalam

Privacy
• Location is used only while the app is open — to stamp collections and,
  while the collection screen is open, to show the route to your office.
• Data is hosted in India.
• Privacy policy: https://zolofunds.com/privacy
• Delete your account: https://zolofunds.com/delete-account

Zolo Funds is a product of Animazon, Erode, Tamil Nadu.
```

Screenshots: phone 1080×1920+, at least 4 — login, agent dashboard, collection
screen, customer detail. **Do not** show borrower screens, prices, or other
lending modules (they are not in the Play build). Feature graphic 1024×500.

## 2. App content → Privacy policy
`https://zolofunds.com/privacy`

## 3. App content → Ads
**No**, the app does not contain ads.

## 4. App content → App access
**All or some functionality is restricted** → add instructions:

```
ZoloFund is for staff of lending businesses; accounts are created by the
business administrator. Use these demo accounts (demo business, sample data):

Field agent:   username <AGENT_USER>   password <AGENT_PASS>
Branch admin:  username <ADMIN_USER>   password <ADMIN_PASS>

No OTP or 2-step verification is needed for these accounts.
Location permission is requested when recording a collection; collections
can be viewed without it.
```

## 5. App content → Content rating (IARC)
Category **Utility, Productivity, Communication or Other**. Answer **No** to all
violence, sexuality, language, controlled-substance, gambling and user-interaction
questions (no chat between users, no user-generated public content, no location
sharing *with other users* — location goes to the user's own employer). Expected
rating: **Everyone / 3+**.

## 6. App content → Target audience
Age groups: **18 and over only**. Not designed for children. No appeal to children.

## 7. App content → News apps / Government apps / Health / COVID
No / No / No / No.

## 8. App content → Financial features declaration
Answer **Yes, my app provides financial features** — do not answer "none": the app
records loan repayments and opens bank e-mandates. Pick the option(s) closest to
*loan servicing / repayment tracking for businesses* and **not** "Personal loans".
If asked for a description or "Other":

```
Lending-operations (loan management) software used only by the staff of
registered lending businesses (NBFCs, micro-finance institutions, licensed
money lenders) to manage their loan book and record repayments. The app does
not offer, arrange, facilitate or advertise loans to consumers; consumers
cannot sign up. Each lending business is responsible for its own licences.
Developer: Animazon (sole proprietorship), Udyam UDYAM-TN-07-0135439.
```

Have ready if Google asks: Udyam certificate, address proof, and a link to
zolofunds.com/terms (Article 4 — tenant regulatory covenants).

## 9. App content → Data safety

**Does your app collect or share user data?** Yes.
**Is all data encrypted in transit?** Yes.
**Do you provide a way to request data deletion?** Yes → `https://zolofunds.com/delete-account`.
**Independent security review:** No.

Data types (collected = sent off the device; "shared" = sent to a third party):

| Data type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|
| Location → Precise | Yes | No | Required | App functionality, Fraud prevention & security |
| Location → Approximate | Yes | No | Required | App functionality, Fraud prevention & security |
| Personal info → Name | Yes | Yes* | Required | App functionality, Account management |
| Personal info → Email address | Yes | No | Required | Account management |
| Personal info → Phone number | Yes | Yes* | Required | App functionality, Account management |
| Personal info → Address | Yes | Yes* | Required | App functionality |
| Personal info → Other info (PAN, Aadhaar, date of birth, ID documents) | Yes | Yes* | Required | App functionality, Fraud prevention & security |
| Financial info → Other financial info (loan amounts, repayments) | Yes | No | Required | App functionality |
| Financial info → Credit score | Yes | No | Optional | App functionality |
| Photos and videos → Photos | Yes | No | Optional | App functionality |
| App activity → Other actions (approvals, collection edits — audit trail) | Yes | No | Required | App functionality, Fraud prevention & security |
| Device or other IDs (push-notification token) | Yes | No | Required | App functionality |

\* Shared only when the lending business runs a KYC check (Digio) or a credit-bureau
check (CRIF High Mark / TransUnion CIBIL) on a customer.

Not collected: contacts, SMS, call logs, calendar, audio (voice entry is turned into
text by the phone; no audio leaves the app), files, web history, health, installed
apps, crash logs/diagnostics, advertising ID.

Ephemeral processing: No. Data is processed on behalf of the lending business that
holds the account.

## 10. Permissions declarations

The Play build requests: INTERNET, CAMERA, ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION,
POST_NOTIFICATIONS, USE_BIOMETRIC, RECORD_AUDIO, READ_MEDIA_IMAGES (and legacy
storage on Android ≤12). Libraries add normal (no-prompt) permissions: ACCESS_NETWORK_STATE, WAKE_LOCK, VIBRATE, NFC, READ_BASIC_PHONE_STATE, USE_FINGERPRINT — no declaration needed. **No** background location → no location declaration form.
No SMS / call-log / contacts / QUERY_ALL_PACKAGES / exact-alarm → no extra forms.
CI fails the bundle if ACCESS_BACKGROUND_LOCATION or cleartext HTTP sneaks back in.

## 11. Release
Start with **Internal testing** (your own team), then **Production**. Organisation
accounts are not subject to the 12-tester / 14-day closed-test rule.
Countries: **India** only for v1.
