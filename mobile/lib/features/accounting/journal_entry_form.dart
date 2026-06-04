import 'package:flutter/material.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/shared/widgets/app_button.dart';

class JournalEntryForm extends StatefulWidget {
  const JournalEntryForm({super.key});

  @override
  State<JournalEntryForm> createState() => _JournalEntryFormState();
}

class _JournalEntryFormState extends State<JournalEntryForm> {
  final List<Map<String, dynamic>> _lines = [
    {'account': 'Cash Account', 'debit': 0.0, 'credit': 0.0},
    {'account': 'Revenue Account', 'debit': 0.0, 'credit': 0.0},
  ];
  final TextEditingController _narrationCtrl = TextEditingController();

  double get _totalDebits => _lines.fold(0.0, (sum, item) => sum + (item['debit'] as double));
  double get _totalCredits => _lines.fold(0.0, (sum, item) => sum + (item['credit'] as double));

  @override
  void dispose() {
    _narrationCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final balanced = _totalDebits == _totalCredits && _totalDebits > 0;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('New Journal Entry'),
        centerTitle: true,
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Narration
            TextField(
              controller: _narrationCtrl,
              decoration: InputDecoration(
                labelText: 'Narration / Description *',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: AppColors.surface,
              ),
            ),
            const SizedBox(height: 20),

            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Lines', style: AppTypography.sectionTitle),
                TextButton.icon(
                  onPressed: () {
                    setState(() {
                      _lines.add({'account': 'Cash Account', 'debit': 0.0, 'credit': 0.0});
                    });
                  },
                  icon: const Icon(Icons.add),
                  label: const Text('Add Line'),
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Ledger Lines List
            for (int i = 0; i < _lines.length; i++) ...[
              _buildLineCard(i),
              const SizedBox(height: 12),
            ],

            const SizedBox(height: 16),
            // Balance Summary
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: balanced ? AppColors.successBg : AppColors.dangerBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: balanced ? AppColors.success : AppColors.danger),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Total Debits:', style: AppTypography.body),
                      Text('₹${_totalDebits.toStringAsFixed(2)}', style: AppTypography.bodyLarge),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Total Credits:', style: AppTypography.body),
                      Text('₹${_totalCredits.toStringAsFixed(2)}', style: AppTypography.bodyLarge),
                    ],
                  ),
                  const Divider(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(balanced ? 'Balanced' : 'Out of Balance', style: AppTypography.sectionTitle.copyWith(color: balanced ? AppColors.successText : AppColors.dangerText)),
                      Icon(balanced ? Icons.check_circle : Icons.warning, color: balanced ? AppColors.success : AppColors.danger),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            AppButton(
              label: 'Submit Journal Entry',
              onPressed: balanced ? _submitJE : null,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLineCard(int idx) {
    final item = _lines[idx];
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: item['account'] as String?,
                  items: const [
                    DropdownMenuItem(value: 'Cash Account', child: Text('Cash Account')),
                    DropdownMenuItem(value: 'Revenue Account', child: Text('Revenue Account')),
                    DropdownMenuItem(value: 'Asset Account', child: Text('Asset Account')),
                  ],
                  onChanged: (val) {
                    setState(() {
                      item['account'] = val;
                    });
                  },
                  decoration: const InputDecoration(labelText: 'Account', border: InputBorder.none),
                ),
              ),
              if (_lines.length > 2)
                IconButton(
                  icon: const Icon(Icons.delete_outline, color: AppColors.danger),
                  onPressed: () {
                    setState(() {
                      _lines.removeAt(idx);
                    });
                  },
                ),
            ],
          ),
          const Divider(height: 12),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  initialValue: item['debit'].toString(),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Debit (₹)', border: InputBorder.none),
                  onChanged: (val) {
                    setState(() {
                      item['debit'] = double.tryParse(val) ?? 0.0;
                    });
                  },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextFormField(
                  initialValue: item['credit'].toString(),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Credit (₹)', border: InputBorder.none),
                  onChanged: (val) {
                    setState(() {
                      item['credit'] = double.tryParse(val) ?? 0.0;
                    });
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _submitJE() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Journal Entry submitted successfully')),
    );
    Navigator.pop(context);
  }
}
