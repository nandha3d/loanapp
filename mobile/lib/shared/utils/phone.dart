/// wa.me number: digits only; a bare 10-digit number gets the tenant's country
/// code (setting phone_country_code via /auth/me) — same rule as web
/// lib/utils.ts whatsappNumber (CUST-07).
String whatsappNumber(String phone, String countryCode) {
  final digits = phone.replaceAll(RegExp(r'\D'), '');
  final cc = countryCode.replaceAll(RegExp(r'\D'), '');
  return digits.length == 10 && cc.isNotEmpty ? '$cc$digits' : digits;
}
