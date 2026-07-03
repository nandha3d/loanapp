/// e-NACH mandate models — mirrors the web NachPanel.tsx types.

class NachPresentation {
  const NachPresentation({
    required this.id,
    required this.amount,
    required this.status,
    required this.presentedAt,
    this.failureReason,
  });

  final String id;
  final double amount;
  final String status;
  final DateTime presentedAt;
  final String? failureReason;

  factory NachPresentation.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) =>
        v == null ? 0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    return NachPresentation(
      id: (json['id'] as String?) ?? (json['mandateId'] as String?) ?? '',
      amount: n(json['amount']),
      status: (json['status'] as String?) ?? 'pending',
      presentedAt: DateTime.parse(json['presentedAt'] as String),
      failureReason: json['failureReason'] as String?,
    );
  }
}

class NachMandate {
  const NachMandate({
    required this.id,
    required this.status,
    required this.accountHolderName,
    required this.accountNumber,
    this.bankName,
    required this.ifscCode,
    required this.maxAmount,
    required this.authType,
    this.activatedAt,
    this.razorpayOrderId,
    this.razorpayKeyId,
    this.presentations = const [],
  });

  final String id;
  final String status;
  final String accountHolderName;
  final String accountNumber;
  final String? bankName;
  final String ifscCode;
  final double maxAmount;
  final String authType;
  final DateTime? activatedAt;
  final String? razorpayOrderId;
  final String? razorpayKeyId;
  final List<NachPresentation> presentations;

  factory NachMandate.fromJson(Map<String, dynamic> json) {
    double n(dynamic v) =>
        v == null ? 0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    return NachMandate(
      id: (json['id'] as String?) ?? (json['mandateId'] as String?) ?? '',
      status: (json['status'] as String?) ?? 'created',
      accountHolderName: (json['accountHolderName'] as String?) ?? '',
      accountNumber: (json['accountNumber'] as String?) ?? '',
      bankName: json['bankName'] as String?,
      ifscCode: (json['ifscCode'] as String?) ?? '',
      maxAmount: n(json['maxAmount']),
      authType: (json['authType'] as String?) ?? 'netbanking',
      activatedAt: json['activatedAt'] == null
          ? null
          : DateTime.parse(json['activatedAt'] as String),
      razorpayOrderId: json['razorpayOrderId'] as String?,
      razorpayKeyId: json['razorpayKeyId'] as String?,
      presentations: (json['presentations'] as List<dynamic>? ?? const [])
          .map((dynamic e) => NachPresentation.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
    );
  }

  /// Mask account number for display — show only last 4 digits.
  String get maskedAccount {
    if (accountNumber.length <= 4) return accountNumber;
    return '••••${accountNumber.substring(accountNumber.length - 4)}';
  }
}
