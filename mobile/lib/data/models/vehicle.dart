/// Vehicle model — matches /api/v1/vehicles response.
class Vehicle {
  const Vehicle({
    required this.id,
    required this.registrationNo,
    required this.make,
    required this.model,
    required this.vehicleType,
    required this.repoFlag,
    this.year,
    this.color,
    this.engineNo,
    this.chassisNo,
    this.insuranceExpiry,
    this.rcDocPath,
    this.insurancePath,
    this.status,
    this.loanId,
    this.repoFlaggedAt,
    this.createdAt,
    this.updatedAt,
    this.customer,
    this.loan,
    this.repoFlaggedBy,
  });

  final String id;
  final String registrationNo;
  final String make;
  final String model;
  final String vehicleType;
  final bool repoFlag;
  final int? year;
  final String? color;
  final String? engineNo;
  final String? chassisNo;
  final DateTime? insuranceExpiry;
  final String? rcDocPath;
  final String? insurancePath;
  final String? status;
  final String? loanId;
  final DateTime? repoFlaggedAt;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final VehicleCustomerRef? customer;
  final VehicleLoanRef? loan;
  final VehicleUserRef? repoFlaggedBy;

  factory Vehicle.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(dynamic v) {
      if (v == null) return null;
      try {
        return DateTime.parse(v as String);
      } catch (_) {
        return null;
      }
    }

    return Vehicle(
      id: json['id'] as String,
      registrationNo: (json['registrationNo'] as String?) ?? '',
      make: (json['make'] as String?) ?? '',
      model: (json['model'] as String?) ?? '',
      vehicleType: (json['vehicleType'] as String?) ?? 'two_wheeler',
      repoFlag: (json['repoFlag'] as bool?) ?? false,
      year: json['year'] as int?,
      color: json['color'] as String?,
      engineNo: json['engineNo'] as String?,
      chassisNo: json['chassisNo'] as String?,
      insuranceExpiry: parseDate(json['insuranceExpiry']),
      rcDocPath: json['rcDocPath'] as String?,
      insurancePath: json['insurancePath'] as String?,
      status: json['status'] as String?,
      loanId: json['loanId'] as String?,
      repoFlaggedAt: parseDate(json['repoFlaggedAt']),
      createdAt: parseDate(json['createdAt']),
      updatedAt: parseDate(json['updatedAt']),
      customer: json['customer'] != null
          ? VehicleCustomerRef.fromJson(json['customer'] as Map<String, dynamic>)
          : null,
      loan: json['loan'] != null
          ? VehicleLoanRef.fromJson(json['loan'] as Map<String, dynamic>)
          : null,
      repoFlaggedBy: json['repoFlaggedBy'] != null
          ? VehicleUserRef.fromJson(json['repoFlaggedBy'] as Map<String, dynamic>)
          : null,
    );
  }
}

class VehicleCustomerRef {
  const VehicleCustomerRef({
    required this.id,
    required this.name,
    required this.customerCode,
    this.phone,
  });

  final String id;
  final String name;
  final String customerCode;
  final String? phone;

  factory VehicleCustomerRef.fromJson(Map<String, dynamic> json) =>
      VehicleCustomerRef(
        id: json['id'] as String,
        name: (json['name'] as String?) ?? '',
        customerCode: (json['customerCode'] as String?) ?? '',
        phone: json['phone'] as String?,
      );
}

class VehicleLoanRef {
  const VehicleLoanRef({
    required this.id,
    this.loanCode,
    this.status,
    this.principal,
  });

  final String id;
  final String? loanCode;
  final String? status;
  final double? principal;

  factory VehicleLoanRef.fromJson(Map<String, dynamic> json) {
    double? parseNum(dynamic v) {
      if (v == null) return null;
      if (v is num) return v.toDouble();
      return double.tryParse(v.toString());
    }

    return VehicleLoanRef(
      id: json['id'] as String,
      loanCode: json['loanCode'] as String?,
      status: json['status'] as String?,
      principal: parseNum(json['principal']),
    );
  }
}

class VehicleUserRef {
  const VehicleUserRef({required this.id, this.name});
  final String id;
  final String? name;

  factory VehicleUserRef.fromJson(Map<String, dynamic> json) => VehicleUserRef(
        id: json['id'] as String,
        name: json['name'] as String?,
      );
}
