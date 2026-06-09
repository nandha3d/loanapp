class NpaBucket {
  const NpaBucket({
    required this.count,
    required this.outstanding,
    required this.provisioning,
  });

  final int count;
  final double outstanding;
  final double provisioning;

  factory NpaBucket.fromJson(Map<String, dynamic>? json) {
    return NpaBucket(
      count: _i(json?['count']),
      outstanding: _n(json?['outstanding']),
      provisioning: _n(json?['provisioning']),
    );
  }
}

class NpaSummary {
  const NpaSummary({
    required this.standard,
    required this.sma,
    required this.subStandard,
    required this.doubtful,
    required this.loss,
    required this.total,
    required this.grossNpaRatio,
    required this.asOfDate,
  });

  final NpaBucket standard;
  final NpaBucket sma;
  final NpaBucket subStandard;
  final NpaBucket doubtful;
  final NpaBucket loss;
  final NpaBucket total;
  final double grossNpaRatio;
  final String asOfDate;

  factory NpaSummary.fromJson(Map<String, dynamic> json) {
    return NpaSummary(
      standard: NpaBucket.fromJson(json['standard'] as Map<String, dynamic>?),
      sma: NpaBucket.fromJson(json['sma'] as Map<String, dynamic>?),
      subStandard:
          NpaBucket.fromJson(json['sub_standard'] as Map<String, dynamic>?),
      doubtful: NpaBucket.fromJson(json['doubtful'] as Map<String, dynamic>?),
      loss: NpaBucket.fromJson(json['loss'] as Map<String, dynamic>?),
      total: NpaBucket.fromJson(json['total'] as Map<String, dynamic>?),
      grossNpaRatio: _n(json['grossNpaRatio']),
      asOfDate: (json['asOfDate'] as String?) ?? '',
    );
  }
}

class NpaLoan {
  const NpaLoan({
    required this.id,
    required this.loanCode,
    required this.customerName,
    required this.customerPhone,
    required this.npaStatus,
    required this.npaSubCategory,
    required this.daysOverdue,
    required this.outstandingAmount,
    required this.provisioningRate,
    required this.provisioningAmount,
    required this.upgradeEligible,
  });

  final String id;
  final String loanCode;
  final String customerName;
  final String customerPhone;
  final String npaStatus;
  final String npaSubCategory;
  final int daysOverdue;
  final double outstandingAmount;
  final double provisioningRate;
  final double provisioningAmount;
  final bool upgradeEligible;

  factory NpaLoan.fromJson(Map<String, dynamic> json) {
    final customer = json['customer'] as Map<String, dynamic>? ?? {};
    return NpaLoan(
      id: (json['id'] as String?) ?? '',
      loanCode: (json['loanCode'] as String?) ?? '',
      customerName: (customer['name'] as String?) ?? '',
      customerPhone: (customer['phone'] as String?) ?? '',
      npaStatus: (json['npaStatus'] as String?) ?? '',
      npaSubCategory: (json['npaSubCategory'] as String?) ?? '',
      daysOverdue: _i(json['npaDaysOverdue']),
      outstandingAmount: _n(json['outstandingAmount']),
      provisioningRate: _n(json['provisioningRate']),
      provisioningAmount: _n(json['provisioningAmount']),
      upgradeEligible: json['npaUpgradeEligible'] == true,
    );
  }
}

class NpaHistoryItem {
  const NpaHistoryItem({
    required this.id,
    required this.fromCategory,
    required this.toCategory,
    required this.daysOverdue,
    required this.outstandingAmount,
    required this.provisioningRate,
    required this.provisioningAmount,
    required this.notes,
    required this.createdAt,
  });

  final String id;
  final String fromCategory;
  final String toCategory;
  final int daysOverdue;
  final double outstandingAmount;
  final double provisioningRate;
  final double provisioningAmount;
  final String notes;
  final String createdAt;

  factory NpaHistoryItem.fromJson(Map<String, dynamic> json) {
    return NpaHistoryItem(
      id: (json['id'] as String?) ?? '',
      fromCategory: (json['fromCategory'] as String?) ?? '',
      toCategory: (json['toCategory'] as String?) ?? '',
      daysOverdue: _i(json['daysOverdue']),
      outstandingAmount: _n(json['outstandingAmt']),
      provisioningRate: _n(json['provisioningRate']),
      provisioningAmount: _n(json['provisioningAmount']),
      notes: (json['notes'] as String?) ?? '',
      createdAt: (json['createdAt'] as String?) ?? '',
    );
  }
}

class NpaUpgradeEligibility {
  const NpaUpgradeEligibility({
    required this.eligible,
    required this.reason,
  });

  final bool eligible;
  final String reason;

  factory NpaUpgradeEligibility.fromJson(Map<String, dynamic> json) {
    return NpaUpgradeEligibility(
      eligible: json['eligible'] == true,
      reason: (json['reason'] ?? json['message'] ?? '').toString(),
    );
  }
}

double _n(dynamic v) => v == null
    ? 0
    : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);

int _i(dynamic v) =>
    v == null ? 0 : (v is num ? v.toInt() : int.tryParse(v.toString()) ?? 0);
