# ZoloFund Manual Verification Checklist

This file is not for automation. Use it after automation passes.

## Web UI manual checks

- Customer form field order, validation wording, required-field clarity.
- Loan creation form usability and calculation preview clarity.
- Approval screen clarity for customer, loan, KYC, handover, settlement.
- Collection screen speed and agent/admin usability.
- Receipt layout, print/download behaviour, and professional formatting.
- Report column names, filters, grouping, Excel readability, and PDF layout.
- Admin/settings/module screen clarity.

## Mobile manual checks

- APK install and login on real Android phone.
- GPS permission allowed/denied flows.
- GPS accuracy in real outdoor/indoor use.
- Camera/photo upload and KYC document upload.
- Offline collection with real network off/on.
- Push notification display.
- Performance on a lower-end Android phone.

## External provider manual checks

- Real/sandbox SMS delivery.
- Real/sandbox WhatsApp delivery.
- Email inbox delivery and attachment opening.
- Razorpay checkout UX and webhook confirmation.
- NACH mandate provider/bank sandbox flow.
- Aadhaar/PAN/KYC provider flow.

## Business sign-off checks

- Accountant validates sample ledger entries.
- Branch manager validates cash handover process.
- Collection agent validates field collection process.
- Business validates penalty, NPA, foreclosure, waiver, settlement rules.
- Gold loan business user validates valuation, LTV, pledge receipt, and release process.
