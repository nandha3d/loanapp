double _d(dynamic v) => v == null
    ? 0
    : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);

/// One ledger entry on a wallet account.
class WalletTxn {
  const WalletTxn({
    required this.id,
    required this.type,
    required this.amount,
    required this.balanceAfter,
    required this.createdAt,
    this.refType,
    this.note,
  });

  final String id;
  final String type; // release | disburse | collection | inject | adjustment
  final double amount; // signed: + credit, - debit
  final double balanceAfter;
  final DateTime createdAt;
  final String? refType;
  final String? note;

  bool get isCredit => amount >= 0;

  factory WalletTxn.fromJson(Map<String, dynamic> json) => WalletTxn(
        id: json['id'] as String,
        type: (json['type'] as String?) ?? 'adjustment',
        amount: _d(json['amount']),
        balanceAfter: _d(json['balanceAfter']),
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '')
                ?.toLocal() ??
            DateTime.now(),
        refType: json['refType'] as String?,
        note: json['note'] as String?,
      );
}

/// Current user's float balance + recent ledger.
class WalletMe {
  const WalletMe({required this.balance, required this.transactions});
  final double balance;
  final List<WalletTxn> transactions;

  factory WalletMe.fromJson(Map<String, dynamic> json) => WalletMe(
        balance: _d(json['balance']),
        transactions: (json['transactions'] as List<dynamic>? ?? const [])
            .map((dynamic e) => WalletTxn.fromJson(e as Map<String, dynamic>))
            .toList(growable: false),
      );
}

/// A branch cash pool (admin view).
class BranchPool {
  const BranchPool({
    required this.branchId,
    required this.branchName,
    required this.balance,
  });
  final String branchId;
  final String branchName;
  final double balance;

  factory BranchPool.fromJson(Map<String, dynamic> json) => BranchPool(
        branchId: json['branchId'] as String,
        branchName: (json['branchName'] as String?) ?? '—',
        balance: _d(json['balance']),
      );
}

/// An agent + their float balance (admin view).
class AgentWallet {
  const AgentWallet({
    required this.agentId,
    required this.name,
    required this.balance,
    this.phone,
    this.branchId,
  });
  final String agentId;
  final String name;
  final double balance;
  final String? phone;
  /// WAL-02: the exceeds-pool warning compares against this branch's pool.
  final String? branchId;

  factory AgentWallet.fromJson(Map<String, dynamic> json) => AgentWallet(
        agentId: json['agentId'] as String,
        name: (json['name'] as String?) ?? '—',
        balance: _d(json['balance']),
        phone: json['phone'] as String?,
        branchId: json['branchId'] as String?,
      );
}

/// WAL-01: a cash handover (agent → office).
class CashHandover {
  const CashHandover({
    required this.id,
    required this.amount,
    required this.status,
    required this.requestedAt,
    this.agentName,
    this.agentPhone,
    this.remarks,
  });
  final String id;
  final double amount;
  final String status; // pending | confirmed | rejected
  final DateTime requestedAt;
  final String? agentName;
  final String? agentPhone;
  final String? remarks;

  factory CashHandover.fromJson(Map<String, dynamic> json) => CashHandover(
        id: json['id'] as String,
        amount: _d(json['amount']),
        status: (json['status'] as String?) ?? 'pending',
        requestedAt: DateTime.tryParse(json['requestedAt'] as String? ?? '')?.toLocal() ?? DateTime.now(),
        agentName: json['agentName'] as String?,
        agentPhone: json['agentPhone'] as String?,
        remarks: json['remarks'] as String?,
      );
}

/// WAL-01: the four wallet KPI figures (GET /wallet/summary).
class WalletSummary {
  const WalletSummary({
    required this.accountingCapital,
    required this.releasedToAgents,
    required this.branchCashAvailable,
    required this.agentFloat,
  });
  final double accountingCapital;
  final double releasedToAgents;
  final double branchCashAvailable;
  final double agentFloat;

  factory WalletSummary.fromJson(Map<String, dynamic> json) {
    final s = (json['summary'] as Map<String, dynamic>?) ?? const {};
    return WalletSummary(
      accountingCapital: _d(s['accountingCapital']),
      releasedToAgents: _d(s['releasedToAgents']),
      branchCashAvailable: _d(s['branchCashAvailable']),
      agentFloat: _d(s['agentFloat']),
    );
  }
}
