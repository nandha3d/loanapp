import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/services/accounting_service.dart';
import 'package:loantrack/shared/widgets/app_button.dart';

class BankReconciliationScreen extends ConsumerStatefulWidget {
  const BankReconciliationScreen({super.key});

  @override
  ConsumerState<BankReconciliationScreen> createState() => _BankReconciliationScreenState();
}

class _BankReconciliationScreenState extends ConsumerState<BankReconciliationScreen> {
  bool _isLoading = true;
  String _error = '';
  List<Map<String, dynamic>> _bankAccounts = [];
  List<Map<String, dynamic>> _ledgerAccounts = [];

  Map<String, dynamic>? _selectedBankAccount;
  List<dynamic> _statements = [];

  Map<String, dynamic>? _selectedStatement;
  List<dynamic> _statementLines = [];

  @override
  void initState() {
    super.initState();
    _fetchBankAccounts();
  }

  Future<void> _fetchBankAccounts() async {
    setState(() {
      _isLoading = true;
      _error = '';
      _selectedBankAccount = null;
      _selectedStatement = null;
    });
    try {
      final data = await ref.read(accountingServiceProvider).listBankAccounts();
      setState(() {
        _bankAccounts = List<Map<String, dynamic>>.from(data['bankAccounts'] as List);
        _ledgerAccounts = List<Map<String, dynamic>>.from(data['ledgerAccounts'] as List);
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _viewBankAccount(Map<String, dynamic> account) async {
    setState(() {
      _isLoading = true;
      _error = '';
      _selectedBankAccount = account;
      _selectedStatement = null;
    });
    try {
      final data = await ref.read(accountingServiceProvider).getBankAccountDetail(account['id'] as String);
      final details = data['bankAccount'] as Map<String, dynamic>;
      setState(() {
        _statements = details['statements'] as List<dynamic>? ?? [];
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _viewStatement(Map<String, dynamic> stmt) async {
    setState(() {
      _isLoading = true;
      _error = '';
      _selectedStatement = stmt;
    });
    try {
      final data = await ref.read(accountingServiceProvider).getStatementWithLines(stmt['id'] as String);
      final details = data['statement'] as Map<String, dynamic>;
      setState(() {
        _statementLines = details['lines'] as List<dynamic>? ?? [];
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _handleLineAction(String action, String lineId, [String? propId]) async {
    setState(() => _isLoading = true);
    try {
      final service = ref.read(accountingServiceProvider);
      if (action == 'accept') {
        await service.acceptMatchProposal(propId!);
      } else if (action == 'reject') {
        await service.rejectMatchProposal(propId!);
      } else if (action == 'ignore') {
        await service.ignoreLine(lineId);
      } else if (action == 'unmatch') {
        await service.unmatchLine(lineId);
      }
      // Reload statement lines
      await _viewStatement(_selectedStatement!);
    } catch (e) {
      setState(() => _isLoading = false);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Action failed: $e')),
      );
    }
  }

  Future<void> _reconcileStatement() async {
    setState(() => _isLoading = true);
    try {
      await ref.read(accountingServiceProvider).reconcileStatement(_selectedStatement!['id'] as String);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Statement reconciled successfully')),
      );
      await _viewBankAccount(_selectedBankAccount!);
    } catch (e) {
      setState(() => _isLoading = false);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Reconcile failed: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(_selectedStatement != null
            ? 'Statement Details'
            : _selectedBankAccount != null
                ? 'Statements History'
                : 'Bank Reconciliation',),
        centerTitle: true,
        leading: (_selectedBankAccount != null || _selectedStatement != null)
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () {
                  if (_selectedStatement != null) {
                    _viewBankAccount(_selectedBankAccount!);
                  } else {
                    _fetchBankAccounts();
                  }
                },
              )
            : null,
        actions: [
          if (_selectedStatement == null)
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: () {
                if (_selectedBankAccount != null) {
                  _viewBankAccount(_selectedBankAccount!);
                } else {
                  _fetchBankAccounts();
                }
              },
            ),
        ],
      ),
      body: SafeArea(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _error.isNotEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text('Error: $_error', style: const TextStyle(color: AppColors.danger)),
                          const SizedBox(height: 16),
                          AppButton(
                            label: 'Back',
                            onPressed: () => _fetchBankAccounts(),
                          ),
                        ],
                      ),
                    ),
                  )
                : _selectedStatement != null
                    ? _buildStatementLinesView()
                    : _selectedBankAccount != null
                        ? _buildStatementsView()
                        : _buildAccountsListView(),
      ),
      floatingActionButton: _selectedStatement != null
          ? null
          : FloatingActionButton(
              onPressed: () {
                if (_selectedBankAccount != null) {
                  _showImportStatementSheet();
                } else {
                  _showCreateAccountSheet();
                }
              },
              backgroundColor: AppColors.primary,
              child: const Icon(Icons.add, color: Colors.white),
            ),
    );
  }

  Widget _buildAccountsListView() {
    if (_bankAccounts.isEmpty) {
      return const Center(child: Text('No active bank accounts configured. Add one below.'));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _bankAccounts.length,
      itemBuilder: (context, index) {
        final ba = _bankAccounts[index];
        final bookBal = ba['bookBalance'] as num? ?? 0;
        final accountNo = ba['accountNo'] as String? ?? '';
        final bankName = ba['bankName'] as String? ?? '';

        return InkWell(
          onTap: () => _viewBankAccount(ba),
          child: Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(AppTokens.radius),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                const CircleAvatar(
                  backgroundColor: AppColors.primaryLight,
                  child: Icon(Icons.account_balance, color: AppColors.primary),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(ba['name'] as String? ?? '', style: AppTypography.nameLg.copyWith(fontSize: 16)),
                      Text('$bankName · A/C: $accountNo', style: AppTypography.caption),
                    ],
                  ),
                ),
                Text(
                  '₹${bookBal.toStringAsFixed(2)}',
                  style: AppTypography.nameLg.copyWith(fontSize: 15, color: AppColors.primary),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildStatementsView() {
    final name = _selectedBankAccount!['name'] as String? ?? '';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Text('Bank Account: $name', style: AppTypography.sectionTitle),
        ),
        Expanded(
          child: _statements.isEmpty
              ? const Center(child: Text('No statement files imported for this account yet.'))
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: _statements.length,
                  itemBuilder: (context, index) {
                    final stmt = Map<String, dynamic>.from(_statements[index] as Map);
                    final from = (stmt['statementFrom'] as String).split('T')[0];
                    final to = (stmt['statementTo'] as String).split('T')[0];
                    final status = stmt['status'] as String? ?? 'imported';
                    final isReconciled = status == 'reconciled';
                    final linesCount = stmt['_count']?['lines'] ?? 0;

                    return InkWell(
                      onTap: () => _viewStatement(stmt),
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(AppTokens.radius),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('$from to $to', style: AppTypography.nameLg.copyWith(fontSize: 14)),
                                Text('$linesCount Transactions · Closing: ₹${stmt['closingBalance']}', style: AppTypography.caption),
                              ],
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: isReconciled ? AppColors.successBg : AppColors.warningBg,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                status.toUpperCase(),
                                style: AppTypography.tiny.copyWith(
                                  color: isReconciled ? AppColors.success : AppColors.warning,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildStatementLinesView() {
    final stmtName = _selectedStatement!['fileName'] as String? ?? '';
    final unmatched = _statementLines.where((l) => l['status'] == 'unmatched').length;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(stmtName, style: AppTypography.sectionTitle, overflow: TextOverflow.ellipsis),
                    Text('$unmatched transactions unmatched', style: AppTypography.caption),
                  ],
                ),
              ),
              if (unmatched == 0 && _selectedStatement!['status'] != 'reconciled')
                AppButton(
                  size: AppButtonSize.small,
                  label: 'Reconcile Statement',
                  onPressed: _reconcileStatement,
                ),
            ],
          ),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: _statementLines.length,
            itemBuilder: (context, index) {
              final line = Map<String, dynamic>.from(_statementLines[index] as Map);
              final date = (line['postingDate'] as String).split('T')[0];
              final desc = line['description'] as String? ?? '';
              final debit = line['debit'] as num? ?? 0;
              final credit = line['credit'] as num? ?? 0;
              final amount = debit > 0 ? -debit : credit;
              final isDebit = amount < 0;

              final status = line['status'] as String? ?? 'unmatched';
              final isMatched = status == 'matched';
              final isIgnored = status == 'ignored';

              final proposals = line['proposals'] as List<dynamic>? ?? [];

              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          isMatched
                              ? Icons.check_circle
                              : isIgnored
                                  ? Icons.remove_circle_outline
                                  : Icons.help_outline,
                          color: isMatched
                              ? AppColors.success
                              : isIgnored
                                  ? AppColors.textSecondary
                                  : AppColors.warning,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(desc, style: AppTypography.bodyLarge.copyWith(fontSize: 14)),
                              Text(date, style: AppTypography.caption),
                            ],
                          ),
                        ),
                        Text(
                          '${isDebit ? '-' : '+'}₹${amount.abs().toStringAsFixed(2)}',
                          style: AppTypography.bodyLarge.copyWith(
                            color: isDebit ? AppColors.danger : AppColors.success,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    if (isMatched && line['matchedJournalLine'] != null) ...[
                      const Divider(height: 16),
                      Text(
                        'Matched to JE: ${line['matchedJournalLine']['entry']?['entryNo'] ?? ''} - ${line['matchedJournalLine']['entry']?['narration'] ?? ''}',
                        style: AppTypography.caption.copyWith(color: AppColors.success, fontWeight: FontWeight.bold),
                      ),
                      TextButton(
                        onPressed: () => _handleLineAction('unmatch', line['id'] as String),
                        child: const Text('Unmatch Transaction', style: TextStyle(color: AppColors.danger, fontSize: 12)),
                      ),
                    ],
                    if (isIgnored) ...[
                      const Divider(height: 16),
                      TextButton(
                        onPressed: () => _handleLineAction('unmatch', line['id'] as String),
                        child: const Text('Restore Transaction', style: TextStyle(color: AppColors.primary, fontSize: 12)),
                      ),
                    ],
                    if (status == 'unmatched') ...[
                      const Divider(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('No auto-matches.', style: AppTypography.caption),
                          TextButton(
                            onPressed: () => _handleLineAction('ignore', line['id'] as String),
                            child: const Text('Ignore Line', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                          ),
                        ],
                      ),
                      if (proposals.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        const Text('Reconciliation Match Proposals:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 4),
                        ...proposals.map((p) {
                          final prop = Map<String, dynamic>.from(p as Map);
                          return Container(
                            margin: const EdgeInsets.only(top: 6),
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: AppColors.background,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text('Reason: ${prop['reason']}', style: const TextStyle(fontSize: 11)),
                                ),
                                Row(
                                  children: [
                                    IconButton(
                                      icon: const Icon(Icons.close, color: AppColors.danger, size: 18),
                                      onPressed: () => _handleLineAction('reject', line['id'] as String, prop['id'] as String),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.check, color: AppColors.success, size: 18),
                                      onPressed: () => _handleLineAction('accept', line['id'] as String, prop['id'] as String),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          );
                        }),
                      ],
                    ],
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  void _showCreateAccountSheet() {
    final nameCtrl = TextEditingController();
    final bankCtrl = TextEditingController();
    final noCtrl = TextEditingController();
    final ifscCtrl = TextEditingController();
    final balCtrl = TextEditingController(text: '0');

    String? selectedLedgerId = _ledgerAccounts.isNotEmpty ? _ledgerAccounts[0]['id'] as String : null;

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
              child: ListView(
                shrinkWrap: true,
                children: [
                  Text('Add Bank Account', style: AppTypography.sectionTitle),
                  const SizedBox(height: 16),
                  TextField(
                    controller: nameCtrl,
                    decoration: const InputDecoration(labelText: 'Account Display Name *', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: bankCtrl,
                    decoration: const InputDecoration(labelText: 'Bank Name *', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: noCtrl,
                    decoration: const InputDecoration(labelText: 'Account Number *', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: ifscCtrl,
                    decoration: const InputDecoration(labelText: 'IFSC Code', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: balCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Opening Balance *', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  if (_ledgerAccounts.isNotEmpty)
                    DropdownButtonFormField<String>(
                      initialValue: selectedLedgerId,
                      decoration: const InputDecoration(labelText: 'COA Ledger Account *', border: OutlineInputBorder()),
                      items: _ledgerAccounts.map((a) => DropdownMenuItem(
                            value: a['id'] as String,
                            child: Text('[${a['code']}] ${a['name']}'),
                          ),).toList(),
                      onChanged: (val) {
                        setModalState(() => selectedLedgerId = val);
                      },
                    ),
                  const SizedBox(height: 16),
                  AppButton(
                    label: 'Create Account',
                    onPressed: () async {
                      final name = nameCtrl.text.trim();
                      final bank = bankCtrl.text.trim();
                      final no = noCtrl.text.trim();
                      final op = double.tryParse(balCtrl.text.trim()) ?? 0.0;

                      if (name.isEmpty || bank.isEmpty || no.isEmpty || selectedLedgerId == null) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Please fill all mandatory fields')),
                        );
                        return;
                      }

                      final messenger = ScaffoldMessenger.of(this.context);
                      Navigator.pop(context);
                      setState(() => _isLoading = true);

                      try {
                        await ref.read(accountingServiceProvider).createBankAccount(
                              name: name,
                              bankName: bank,
                              accountNo: no,
                              ifsc: ifscCtrl.text.trim().isNotEmpty ? ifscCtrl.text.trim() : null,
                              ledgerAccountId: selectedLedgerId!,
                              openingBalance: op,
                              openingAsOf: DateTime.now().toUtc().toIso8601String(),
                            );
                        await _fetchBankAccounts();
                      } catch (e) {
                        setState(() => _isLoading = false);
                        if (!mounted) return;
                        messenger.showSnackBar(
                          SnackBar(content: Text('Failed: $e')),
                        );
                      }
                    },
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _showImportStatementSheet() {
    final fromCtrl = TextEditingController(text: DateTime.now().subtract(const Duration(days: 30)).toString().split(' ')[0]);
    final toCtrl = TextEditingController(text: DateTime.now().toString().split(' ')[0]);
    final openCtrl = TextEditingController(text: '0');
    final closeCtrl = TextEditingController(text: '0');

    // Default mock row templates
    final rowsList = [
      {'postingDate': DateTime.now().subtract(const Duration(days: 2)).toString().split(' ')[0], 'description': 'UPI PAY FROM KARTHIK S', 'debit': 0.0, 'credit': 1500.0, 'reference': 'UPI983742'},
      {'postingDate': DateTime.now().subtract(const Duration(days: 4)).toString().split(' ')[0], 'description': 'DISBURSE LN0394 SALEM', 'debit': 25000.0, 'credit': 0.0, 'reference': 'TXN827364'},
    ];

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
          child: ListView(
            shrinkWrap: true,
            children: [
              Text('Import CSV Bank Statement', style: AppTypography.sectionTitle),
              const SizedBox(height: 16),
              TextField(
                controller: fromCtrl,
                decoration: const InputDecoration(labelText: 'Statement From Date (YYYY-MM-DD) *', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: toCtrl,
                decoration: const InputDecoration(labelText: 'Statement To Date (YYYY-MM-DD) *', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: openCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Opening Balance *', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: closeCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Closing Balance *', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 16),
              const Text('The following CSV lines will be imported:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
              const SizedBox(height: 8),
              ...rowsList.map((r) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Text(
                      '${r['postingDate']} - ${r['description']} - Dr: ${r['debit']}, Cr: ${r['credit']}',
                      style: const TextStyle(fontSize: 11, fontStyle: FontStyle.italic),
                    ),
                  ),),
              const SizedBox(height: 16),
              AppButton(
                label: 'Upload & Parse CSV Data',
                onPressed: () async {
                  final fromDate = fromCtrl.text.trim();
                  final toDate = toCtrl.text.trim();
                  final op = double.tryParse(openCtrl.text.trim()) ?? 0.0;
                  final cl = double.tryParse(closeCtrl.text.trim()) ?? 0.0;

                  if (fromDate.isEmpty || toDate.isEmpty) return;

                  final messenger = ScaffoldMessenger.of(this.context);
                  Navigator.pop(context);
                  setState(() => _isLoading = true);

                  try {
                    await ref.read(accountingServiceProvider).importStatement(
                          bankAccountId: _selectedBankAccount!['id'] as String,
                          rows: rowsList,
                          statementFrom: fromDate,
                          statementTo: toDate,
                          openingBalance: op,
                          closingBalance: cl,
                        );
                    await _viewBankAccount(_selectedBankAccount!);
                  } catch (e) {
                    setState(() => _isLoading = false);
                    if (!mounted) return;
                    messenger.showSnackBar(
                      SnackBar(content: Text('Failed: $e')),
                    );
                  }
                },
              ),
            ],
          ),
        );
      },
    );
  }
}
