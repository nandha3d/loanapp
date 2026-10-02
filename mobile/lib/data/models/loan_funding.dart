/// Loan funding figures (FUND-1). Every number is computed by the server
/// (`lib/loanFundingPolicy.ts`); the app only renders them.
class LoanFunding {
  const LoanFunding({
    required this.source,
    required this.required,
    required this.available,
    required this.committed,
    required this.shortfall,
    required this.queueShortfall,
    required this.capitalNeeded,
    required this.sufficient,
    this.branchId,
    this.branchPool,
    this.agentId,
    this.alertsSent = false,
  });

  /// `agent` (agent float), `branch` (branch pool) or `none` (no cash leg).
  final String source;
  final double required;
  final double available;
  final double committed;
  final double shortfall;
  final double queueShortfall;
  final double capitalNeeded;
  final bool sufficient;
  final String? branchId;
  final double? branchPool;
  final String? agentId;
  final bool alertsSent;

  bool get isAgent => source == 'agent';
  bool get isBranch => source == 'branch';

  static double _d(dynamic v) =>
      v is num ? v.toDouble() : double.tryParse('${v ?? ''}') ?? 0;

  static LoanFunding? tryParse(dynamic json) {
    if (json is! Map) return null;
    final m = Map<String, dynamic>.from(json);
    if (m['source'] == null) return null;
    return LoanFunding(
      source: m['source'].toString(),
      required: _d(m['required']),
      available: _d(m['available']),
      committed: _d(m['committed']),
      shortfall: _d(m['shortfall']),
      queueShortfall: _d(m['queueShortfall']),
      capitalNeeded: _d(m['capitalNeeded']),
      sufficient: m['sufficient'] == true,
      branchId: m['branchId']?.toString(),
      branchPool: m['branchPool'] == null ? null : _d(m['branchPool']),
      agentId: m['agentId']?.toString(),
      alertsSent: m['alertsSent'] == true,
    );
  }

  /// Wallet route that opens the row that unblocks this loan (FUND-4).
  String walletRoute() {
    if (isAgent && agentId != null) {
      return '/wallet?agent=${Uri.encodeComponent(agentId!)}&release=$shortfall';
    }
    if (branchId != null) {
      return '/wallet?branch=${Uri.encodeComponent(branchId!)}&topup=$shortfall';
    }
    return '/wallet';
  }
}
