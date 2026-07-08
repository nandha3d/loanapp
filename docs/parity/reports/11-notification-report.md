# 11 · Notification Report

**Status:** 🆕 NEW · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
All outbound messages — SMS / WhatsApp / Email / in-app — with delivery status. The operator's list of
"SMS Sent / WhatsApp Sent / Reminders Sent / Failed Messages" is **one report** with channel + status as
filters, over the existing `NotificationLog`.

## 2. Source models (READ ONLY)
- `NotificationLog` (`:797`): `channel` (sms/whatsapp/email/inapp), `recipient`, `status` (pending/sent/
  delivered/failed), `event`, `entityType`, `entityId`, `provider`, `providerMsgId`, `createdAt`,
  `messageBody`.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Date/Time | `createdAt` | datetime | left | |
| Channel | `channel` | badge | center | |
| Recipient | `recipient` | text | left | |
| Event | `event` | text | left | |
| Status | `status` | badge | center | |
| Provider | `provider` | text | left | |

## 4. KPI cards
Sent · delivered · failed · delivery rate % (per channel chips).

## 5. Filters
Date range, Channel, Status, Event, Branch.

## 6. API contract
`GET /api/v1/reports/notification?from&to&channel?&status?&event?&branchId?&cursor?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/notification.ts`)
`findMany`/`groupBy` over `NotificationLog` (scoped by tenant; branch via entity where applicable); KPIs via
`groupBy status`.

## 8. Export mapping
6 columns → CSV/Excel/PDF/Print. `messageBody` optional column (admin export only). Filename
`notifications-<from>-to-<to>`.

## 9. i18n keys
`reports.notification.title`, `reports.col.channel|recipient|event|status|provider`, `reports.channel.sms|whatsapp|email|inapp`.

## 10. RBAC + subscription
Admin/manager. Message body PII → admin-only. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only over `NotificationLog`. No writes, no new columns, no resend from this report.

## 12. No-hardcode checklist
- [ ] Channel/status/event options from distinct DB values. Labels from i18n.

## 13. Test plan
Seed notifications across channels/statuses → assert filtered rows + delivery-rate KPI; export matches.
