## 2024-05-20 - Backend Performance Issue
**Learning:** Adding composite indices on \`tenantId\`, \`appType\`, and \`status\` significantly improves query performance across active list operations (customers, loans) and dashboard aggregations. Similar pattern needed for \`loanId\`, \`dueDate\`, \`status\` in \`Instalment\` lookup.
**Action:** Always add composite indices that mirror the most common multi-column \`WHERE\` clauses when defining Prisma models.
