# J4 — Settings: Payment / UPI + Receipt PDF toggle (mobile)

**Priority:** P1 · **Persona:** Admin. · Reuses `/api/v1/settings` + `/api/v1/upload`.

## Story
As an **admin**, I want to set the tenant UPI id, upload a UPI QR image, and toggle Receipt-PDF availability.

## Verified facts
- appSetting keys: `upi_id`, `upi_qr_url`, `receipt_pdf_active` ("true"/"false"). Web tab `activeTab==='payment'` in `SettingsClient.tsx:306+`. Receipt-PDF block only when `subscription.receiptPdfAllowed`.
- Image upload: `app/api/v1/upload/route.ts` (mobile `uploadServiceProvider.uploadFile(file)` → `{url}`). Save returned url into `upi_qr_url`.
- Receipt gate ties to `J10`/subscription; receipt PDF feature already implemented (`/api/v1/receipts/[entryId]`).

## Implementation
1. Sub-screen `payment_settings_screen.dart`, admin-gated.
2. `upi_id` TextField; current `upi_qr_url` preview (if set) + pick image (`image_picker`) → `uploadFile` → store url in state.
3. `receipt_pdf_active` Switch (show only if subscription allows; else disabled with note — expose `receiptPdfAllowed` on `/api/v1/auth/me` if needed).
4. Save: `settingsService.save({'upi_id':…, if(newQr)'upi_qr_url':url, 'receipt_pdf_active': val})`.

## i18n
`set.payment`="Payment / UPI" · `set.upi_id`="UPI ID" · `set.upi_qr`="UPI QR image" · `set.receipt_pdf`="Enable Receipt & Statement PDFs" · `set.payment_saved`="Payment settings saved".

## Acceptance criteria
- [ ] UPI id + QR persist; QR preview shows uploaded image.
- [ ] Receipt toggle reflects + persists; gated by subscription.
- [ ] Hidden for agents.

## Files touched
- NEW `mobile/lib/features/settings/payment_settings_screen.dart` + route.
- `app_strings.dart`.
- *(optional)* `/api/v1/auth/me` + `User` model for `receiptPdfAllowed`.
