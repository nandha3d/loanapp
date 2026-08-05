# ZoloFund Complete Automation Test Sketches — Index

Use these files as Codex implementation prompts. Each file covers one automation type/module.

## Recommended build order

1. `01_auth_rbac_tenant_isolation.md`
2. `02_customer_kyc_approval.md`
3. `03_loan_package_creation_approval.md`
4. `04_disbursement_accounting_ledger.md`
5. `05_collection_repayment_receipt.md`
6. `06_wallet_float_cash_handover.md`
7. `09_reports_exports.md`
8. `13_security_abuse.md`
9. `07_penalty_overdue_npa_foreclosure.md`
10. `10_cron_jobs_idempotency.md`
11. `08_gold_loan_automation.md`
12. `11_borrower_payments_nach.md`
13. `12_mobile_agent_integration.md`
14. `14_web_ui_playwright_e2e.md`
15. `15_chits_vehicle_special_modules.md`

## High-value first target

Build this one P0 test first:

`tenant + branch + admin + agent + customer approval + loan approval + disbursement + collection + wallet + handover + reports + audit logs`

This single flow validates the most important ZoloFund business behaviour: money movement and data correctness.

## Automation vs manual principle

Automate all repeatable business rules, APIs, DB checks, ledger checks, wallet checks, report totals, cron idempotency, and security boundaries.

Manually verify visual comfort, mobile real-device behaviour, receipt layout, SMS/WhatsApp/email delivery, Razorpay/NACH sandbox experience, GPS accuracy, and final business sign-off.
