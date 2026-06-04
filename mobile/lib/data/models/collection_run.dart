/// mCollect — route batch collection run + sheet models.
class CollectionRun {
  const CollectionRun({
    required this.id,
    required this.status,
    required this.date,
    required this.expectedTotal,
    required this.collectedTotal,
    required this.cashCollected,
    required this.digitalCollected,
    required this.stopsExpected,
    required this.stopsCollected,
    this.cashDeposited,
    this.varianceAmount,
  });

  final String id;
  final String status; // open | collecting | closed | reconciled
  final String date;
  final double expectedTotal;
  final double collectedTotal;
  final double cashCollected;
  final double digitalCollected;
  final int stopsExpected;
  final int stopsCollected;
  final double? cashDeposited;
  final double? varianceAmount;

  static double _d(dynamic v) =>
      v is num ? v.toDouble() : double.tryParse('${v ?? 0}') ?? 0;
  static int _i(dynamic v) =>
      v is num ? v.toInt() : int.tryParse('${v ?? 0}') ?? 0;

  factory CollectionRun.fromJson(Map<String, dynamic> j) {
    return CollectionRun(
      id: (j['id'] as String?) ?? '',
      status: (j['status'] as String?) ?? 'open',
      date: (j['date'] as String?) ?? '',
      expectedTotal: _d(j['expectedTotal']),
      collectedTotal: _d(j['collectedTotal']),
      cashCollected: _d(j['cashCollected']),
      digitalCollected: _d(j['digitalCollected']),
      stopsExpected: _i(j['stopsExpected']),
      stopsCollected: _i(j['stopsCollected']),
      cashDeposited: j['cashDeposited'] == null ? null : _d(j['cashDeposited']),
      varianceAmount:
          j['varianceAmount'] == null ? null : _d(j['varianceAmount']),
    );
  }

  bool get isLocked => status == 'closed' || status == 'reconciled';
}

class RunSheetRow {
  const RunSheetRow({
    required this.stopSeq,
    required this.customerId,
    required this.name,
    required this.loanCode,
    required this.instalmentId,
    required this.instalmentNo,
    required this.outstanding,
    required this.overdue,
    required this.daysOverdue,
  });

  final int stopSeq;
  final String customerId;
  final String name;
  final String loanCode;
  final String instalmentId;
  final int instalmentNo;
  final double outstanding;
  final bool overdue;
  final int daysOverdue;

  factory RunSheetRow.fromJson(Map<String, dynamic> j) {
    return RunSheetRow(
      stopSeq: CollectionRun._i(j['stopSeq']),
      customerId: (j['customerId'] as String?) ?? '',
      name: (j['name'] as String?) ?? '',
      loanCode: (j['loanCode'] as String?) ?? '',
      instalmentId: (j['instalmentId'] as String?) ?? '',
      instalmentNo: CollectionRun._i(j['instalmentNo']),
      outstanding: CollectionRun._d(j['outstanding']),
      overdue: j['overdue'] == true,
      daysOverdue: CollectionRun._i(j['daysOverdue']),
    );
  }
}

class RunSheet {
  const RunSheet({required this.run, required this.rows});
  final CollectionRun run;
  final List<RunSheetRow> rows;
}
