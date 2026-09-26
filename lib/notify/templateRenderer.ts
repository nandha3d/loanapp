function replacements(d: Record<string, string>): Record<string, string> {
  return {
    '{customer}': d.name || '',
    '{amount}': d.amount || '',
    '{due_date}': d.date || '',
    '{loan_code}': d.loanCode || '',
    '{firstDue}': d.firstDue || '',
    '{days}': d.days || '',
    '{penalty}': d.penalty || '',
    '{balance}': d.balance || '',
    '{orgName}': d.orgName || '',
    '{start_date}': d.start_date || d.startDate || '',
    '{per_instalment}': d.per_instalment || d.perInstalment || '',
    '{principal}': d.principal || '',
    '{groupName}': d.groupName || '',
    '{periodNumber}': d.periodNumber || '',
    '{scheduledAt}': d.scheduledAt || '',
    '{chitValue}': d.chitValue || '',
    '{{customer_name}}': d.name || '',
    '{{amount}}': d.amount || '',
    '{{due_date}}': d.date || '',
    '{{loan_code}}': d.loanCode || '',
    '{{days}}': d.days || '',
    '{{penalty}}': d.penalty || '',
    '{{balance}}': d.balance || '',
    '{{currency_symbol}}': '₹',
    '{{principal}}': d.principal || '',
    '{{start_date}}': d.start_date || d.startDate || '',
    '{{per_instalment}}': d.per_instalment || d.perInstalment || '',
    '{{groupName}}': d.groupName || '',
    '{{periodNumber}}': d.periodNumber || '',
    '{{scheduledAt}}': d.scheduledAt || '',
    '{{chitValue}}': d.chitValue || '',
  };
}

const tokenPattern = /\{\{[^{}]+\}\}|\{[^{}]+\}/g;

export function validateTemplatePlaceholders(template: string): void {
  const supported = replacements({});
  for (const token of template.match(tokenPattern) ?? []) {
    if (!(token in supported)) throw new Error(`Unsupported template placeholder: ${token}`);
  }
}

export function interpolateTemplate(template: string, data: Record<string, string>): string {
  let result = template;
  for (const [token, value] of Object.entries(replacements(data)).sort((a, b) => b[0].length - a[0].length)) {
    result = result.replaceAll(token, value);
  }
  return result;
}

export function extractPlaceholders(template: string, data: Record<string, string>): string[] {
  const values = replacements(data);
  return (template.match(tokenPattern) ?? []).map((token) => values[token] ?? '');
}
