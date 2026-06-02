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
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
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

/// An agent + their float balance (admin view).
class AgentWallet {
  const AgentWallet({
    required this.agentId,
    required this.name,
    required this.balance,
    this.phone,
  });
  final String agentId;
  final String name;
  final double balance;
  final String? phone;

  factory AgentWallet.fromJson(Map<String, dynamic> json) => AgentWallet(
        agentId: json['agentId'] as String,
        name: (json['name'] as String?) ?? '—',
        balance: _d(json['balance']),
        phone: json['phone'] as String?,
      );
}
