/// Customer model — spec §3.2. Extended in Sprint 2 with route/agent nested
/// objects and aadhar (masked) / kycStatus fields surfaced by the v1 API.
class Customer {
  const Customer({
    required this.id,
    required this.customerCode,
    required this.name,
    required this.phone,
    required this.status,
    required this.kycDocuments,
    required this.guarantors,
    required this.loans,
    this.address,
    this.routeId,
    this.agentId,
    this.creditScore,
    this.aadharNumberMasked,
    this.kycStatus,
    this.routeName,
    this.agentName,
    this.photoUrl,
    // Extended profile (web parity)
    this.email,
    this.pan,
    this.occupation,
    this.monthlyIncome,
    this.companyName,
    this.companyType,
    this.businessType,
    this.gstNumber,
    this.companyPan,
    this.companyRegNo,
    this.companyAddress,
    this.companyPhone,
    this.companyEmail,
    this.companyLogo,
    this.designation,
    this.collectionPoints = const [],
    this.securityCheques = const [],
  });

  final String id;
  final String customerCode;
  final String name;
  final String phone;
  final String? address;
  final String status;
  final String? routeId;
  final String? agentId;
  final CreditScore? creditScore;
  final String? aadharNumberMasked;
  final String? kycStatus;
  final String? routeName;
  final String? agentName;
  final String? photoUrl;
  final String? email;
  final String? pan;
  final String? occupation;
  final double? monthlyIncome;
  final String? companyName;
  final String? companyType;
  final String? businessType;
  final String? gstNumber;
  final String? companyPan;
  final String? companyRegNo;
  final String? companyAddress;
  final String? companyPhone;
  final String? companyEmail;
  final String? companyLogo;
  final String? designation;
  final List<CustomerCollectionPoint> collectionPoints;
  final List<KycDocument> kycDocuments;
  final List<Guarantor> guarantors;
  final List<CustomerLoanSummary> loans;
  final List<SecurityCheque> securityCheques;

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+'));
    return parts.map((p) => p.isEmpty ? '' : p[0]).take(2).join().toUpperCase();
  }

  factory Customer.fromJson(Map<String, dynamic> json) {
    final route = json['route'] as Map<String, dynamic>?;
    final agent = json['agent'] as Map<String, dynamic>?;
    return Customer(
      id: json['id'] as String,
      customerCode: json['customerCode'] as String,
      name: json['name'] as String,
      phone: json['phone'] as String,
      address: json['address'] as String?,
      status: (json['status'] as String?) ?? 'pending_review',
      routeId: json['routeId'] as String?,
      agentId: json['agentId'] as String?,
      creditScore: json['creditScore'] is Map<String, dynamic>
          ? CreditScore.fromJson(json['creditScore'] as Map<String, dynamic>)
          : null,
      aadharNumberMasked: json['aadharNumber'] as String?,
      kycStatus: json['kycStatus'] as String?,
      routeName: route?['name'] as String?,
      agentName: agent?['name'] as String?,
      photoUrl: json['profilePhoto'] as String? ?? json['photoUrl'] as String?,
      email: json['email'] as String?,
      pan: json['pan'] as String?,
      occupation: json['occupation'] as String?,
      monthlyIncome: json['monthlyIncome'] == null
          ? null
          : (json['monthlyIncome'] as num).toDouble(),
      companyName: json['companyName'] as String?,
      companyType: json['companyType'] as String?,
      businessType: json['businessType'] as String?,
      gstNumber: json['gstNumber'] as String?,
      companyPan: json['companyPan'] as String?,
      companyRegNo: json['companyRegNo'] as String?,
      companyAddress: json['companyAddress'] as String?,
      companyPhone: json['companyPhone'] as String?,
      companyEmail: json['companyEmail'] as String?,
      companyLogo: json['companyLogo'] as String?,
      designation: json['designation'] as String?,
      kycDocuments: (json['kycDocuments'] as List<dynamic>? ?? const [])
          .map((dynamic e) => KycDocument.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
      guarantors: (json['guarantors'] as List<dynamic>? ?? const [])
          .map((dynamic e) => Guarantor.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
      collectionPoints: (json['collectionPoints'] as List<dynamic>? ?? const [])
          .map((dynamic e) =>
              CustomerCollectionPoint.fromJson(e as Map<String, dynamic>),)
          .toList(growable: false),
      loans: (json['loans'] as List<dynamic>? ?? const [])
          .map(
            (dynamic e) =>
                CustomerLoanSummary.fromJson(e as Map<String, dynamic>),
          )
          .toList(growable: false),
      securityCheques: (json['securityCheques'] as List<dynamic>? ?? const [])
          .map(
            (dynamic e) =>
                SecurityCheque.fromJson(e as Map<String, dynamic>),
          )
          .toList(growable: false),
    );
  }
}

class CustomerCollectionPoint {
  const CustomerCollectionPoint({
    required this.id,
    required this.name,
    required this.address,
    this.latitude,
    this.longitude,
    this.isPrimary = false,
  });

  final String id;
  final String name;
  final String address;
  final double? latitude;
  final double? longitude;
  final bool isPrimary;

  factory CustomerCollectionPoint.fromJson(Map<String, dynamic> json) {
    double? toDouble(dynamic v) =>
        v == null ? null : (v is num ? v.toDouble() : double.tryParse('$v'));
    return CustomerCollectionPoint(
      id: json['id'] as String,
      name: (json['name'] as String?) ?? '',
      address: (json['address'] as String?) ?? '',
      latitude: toDouble(json['latitude']),
      longitude: toDouble(json['longitude']),
      isPrimary: (json['isPrimary'] as bool?) ?? false,
    );
  }
}

/// Canonical credit score — mirrors the server's `calculateCreditScore` output
/// (300–850 scale + grade), so the figure is IDENTICAL to the web. The score is
/// computed server-side only; the app never recomputes it.
class CreditScore {
  const CreditScore({
    required this.score,
    required this.grade,
    this.totalBorrowed = 0,
    this.totalPaid = 0,
    this.punctuality = 0,
    this.activeLoans = 0,
    this.closedLoans = 0,
  });

  final int score; // 300–850 (0 / grade 'N/A' when no loan activity yet)
  final String grade; // Excellent | Good | Fair | Poor | Very Poor | N/A
  final double totalBorrowed;
  final double totalPaid;
  final int punctuality; // 0–100 (% on-time)
  final int activeLoans;
  final int closedLoans;

  bool get rated => grade != 'N/A' && score >= 300;

  factory CreditScore.fromJson(Map<String, dynamic> json) {
    double toNum(dynamic v) =>
        v is num ? v.toDouble() : double.tryParse(v?.toString() ?? '') ?? 0;
    final stats = (json['stats'] as Map<String, dynamic>?) ?? const {};
    return CreditScore(
      score: (json['score'] as num?)?.toInt() ?? 0,
      grade: (json['grade'] as String?) ?? 'N/A',
      totalBorrowed: toNum(stats['totalBorrowed']),
      totalPaid: toNum(stats['totalPaid']),
      punctuality: (stats['punctuality'] as num?)?.toInt() ?? 0,
      activeLoans: (stats['activeLoans'] as num?)?.toInt() ?? 0,
      closedLoans: (stats['closedLoans'] as num?)?.toInt() ?? 0,
    );
  }
}

class KycDocument {
  const KycDocument({required this.id, required this.type, required this.url});
  final String id;
  final String type;
  final String url;

  factory KycDocument.fromJson(Map<String, dynamic> json) => KycDocument(
        id: json['id'] as String,
        type: (json['type'] as String?) ?? '',
        url: (json['url'] as String?) ?? '',
      );
}

class Guarantor {
  const Guarantor({
    required this.id,
    required this.name,
    required this.phone,
    this.address,
    this.aadharNumber,
    this.photoUrl,
    this.relation,
  });
  final String id;
  final String name;
  final String phone;
  final String? address;
  final String? aadharNumber;
  final String? photoUrl;
  final String? relation;

  factory Guarantor.fromJson(Map<String, dynamic> json) => Guarantor(
        id: json['id'] as String,
        name: (json['name'] as String?) ?? '',
        phone: (json['phone'] as String?) ?? '',
        address: json['address'] as String?,
        aadharNumber: json['aadharNumber'] as String?,
        photoUrl: json['photo'] as String?,
        relation: json['relation'] as String?,
      );
}

/// Lightweight loan summary attached to customer list/detail responses.
class CustomerLoanSummary {
  const CustomerLoanSummary({
    required this.id,
    required this.status,
    required this.principal,
    this.loanCode,
  });

  final String id;
  final String status;
  final double principal;
  final String? loanCode;

  factory CustomerLoanSummary.fromJson(Map<String, dynamic> json) {
    final p = json['principal'];
    double principal;
    if (p == null) {
      principal = 0;
    } else if (p is num) {
      principal = p.toDouble();
    } else {
      principal = double.tryParse(p.toString()) ?? 0;
    }
    return CustomerLoanSummary(
      id: json['id'] as String,
      status: (json['status'] as String?) ?? 'active',
      principal: principal,
      loanCode: json['loanCode'] as String?,
    );
  }
}

class SecurityCheque {
  const SecurityCheque({
    required this.id,
    required this.bankName,
    required this.chequeNumber,
    this.amount,
    this.imagePath,
    required this.status,
    this.notes,
    this.loanId,
  });

  final String id;
  final String bankName;
  final String chequeNumber;
  final double? amount;
  final String? imagePath;
  final String status;
  final String? notes;
  final String? loanId;

  factory SecurityCheque.fromJson(Map<String, dynamic> json) {
    double? toDouble(dynamic v) =>
        v == null ? null : (v is num ? v.toDouble() : double.tryParse('$v'));
    return SecurityCheque(
      id: json['id'] as String,
      bankName: (json['bankName'] as String?) ?? '',
      chequeNumber: (json['chequeNumber'] as String?) ?? '',
      amount: toDouble(json['amount']),
      imagePath: json['imagePath'] as String?,
      status: (json['status'] as String?) ?? 'active',
      notes: json['notes'] as String?,
      loanId: json['loanId'] as String?,
    );
  }
}
