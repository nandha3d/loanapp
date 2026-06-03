import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/auth/auth_controller.dart';
import 'package:loantrack/core/currency/currency_controller.dart';
import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/user.dart';
import 'package:loantrack/data/models/wallet.dart';
import 'package:loantrack/data/services/wallet_service.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';

class WalletScreen extends ConsumerWidget {
  const WalletScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final user = ref.watch(authControllerProvider).user;
    final privileged = user?.role == UserRole.admin ||
        user?.role == UserRole.superadmin ||
        user?.role == UserRole.developer;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(t.x('wallet.title')),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/dashboard'),
        ),
      ),
      body: privileged ? const _AdminWallet() : const _AgentWallet(),
    );
  }
}

// ── Agent view: own float balance + ledger ───────────────────────────────
class _AgentWallet extends ConsumerWidget {
  const _AgentWallet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);
    final async = ref.watch(walletMeProvider);

    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) =>
          Center(child: EmptyState(icon: Icons.cloud_off, title: e.toString())),
      data: (w) => RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async => ref.invalidate(walletMeProvider),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            _BalanceHero(balance: w.balance, fmt: fmt, t: t),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  side: const BorderSide(color: AppColors.primary),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
                onPressed:
                    w.balance > 0 ? () => _depositCash(context, ref) : null,
                icon: const Icon(Icons.upload_rounded, size: 18),
                label: Text(t.x('wallet.deposit')),
              ),
            ),
            const SizedBox(height: 18),
            Text(t.x('wallet.history'), style: AppTypography.sectionTitle),
            const SizedBox(height: 10),
            if (w.transactions.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: EmptyState(
                  icon: Icons.receipt_long_outlined,
                  title: t.x('wallet.no_txns'),
                ),
              )
            else
              ...w.transactions.map((tx) => _TxnTile(tx: tx, fmt: fmt, t: t)),
          ],
        ),
      ),
    );
  }

  void _depositCash(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    showDialog<void>(
      context: context,
      builder: (_) => _AmountActionDialog(
        title: t.x('wallet.deposit_title'),
        actionLabel: t.x('wallet.deposit'),
        successMsg: t.x('wallet.deposited'),
        submit: (amount, note) async {
          await ref
              .read(walletServiceProvider)
              .deposit(amount: amount, note: note);
          ref.invalidate(walletMeProvider);
        },
      ),
    );
  }
}

class _BalanceHero extends StatelessWidget {
  const _BalanceHero(
      {required this.balance, required this.fmt, required this.t,});
  final double balance;
  final NumberFormat fmt;
  final T t;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.heroDarkFrom, AppColors.heroDarkTo],
        ),
        boxShadow: AppTokens.shadowLg,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.account_balance_wallet_outlined,
                  color: AppColors.primary, size: 18,),
              const SizedBox(width: 6),
              Text(t.x('wallet.balance'),
                  style:
                      AppTypography.heroLabel.copyWith(color: Colors.white70),),
            ],
          ),
          const SizedBox(height: 12),
          Text(fmt.format(balance),
              style: AppTypography.heroNumber.copyWith(color: Colors.white),),
          const SizedBox(height: 4),
          Text(t.x('wallet.cash_in_hand'),
              style: AppTypography.caption.copyWith(color: Colors.white54),),
        ],
      ),
    );
  }
}

// ── Admin view: agents + release funds ───────────────────────────────────
class _AdminWallet extends ConsumerWidget {
  const _AdminWallet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);
    final agentsAsync = ref.watch(walletAgentsProvider);
    final branchesAsync = ref.watch(walletBranchesProvider);

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () async {
        ref.invalidate(walletAgentsProvider);
        ref.invalidate(walletBranchesProvider);
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          // Branch cash pools.
          branchesAsync.maybeWhen(
            data: (branches) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(t.x('wallet.branch_pools'),
                    style: AppTypography.sectionTitle,),
                const SizedBox(height: 10),
                if (branches.isEmpty)
                  Text(t.x('wallet.no_branches'),
                      style: AppTypography.caption,)
                else
                  ...branches.map((b) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _BranchRow(pool: b, fmt: fmt, t: t),
                      ),),
                const SizedBox(height: 22),
              ],
            ),
            orElse: () => const SizedBox.shrink(),
          ),
          Text(t.x('wallet.agents_float'), style: AppTypography.sectionTitle),
          const SizedBox(height: 10),
          agentsAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (e, _) => Padding(
              padding: const EdgeInsets.all(16),
              child: Text(e.toString(), style: AppTypography.caption),
            ),
            data: (agents) => agents.isEmpty
                ? Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(t.x('wallet.no_agents'),
                        style: AppTypography.caption,),
                  )
                : Column(
                    children: [
                      for (final a in agents)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: _AgentRow(agent: a, fmt: fmt, t: t),
                        ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

/// Generic amount + optional note dialog used for deposit / top-up.
class _AmountActionDialog extends ConsumerStatefulWidget {
  const _AmountActionDialog({
    required this.title,
    required this.actionLabel,
    required this.submit,
    this.successMsg,
  });
  final String title;
  final String actionLabel;
  final String? successMsg;
  final Future<void> Function(double amount, String note) submit;

  @override
  ConsumerState<_AmountActionDialog> createState() =>
      _AmountActionDialogState();
}

class _AmountActionDialogState extends ConsumerState<_AmountActionDialog> {
  final _amount = TextEditingController();
  final _note = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _amount.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _go() async {
    final t = T.of(ref);
    final amount = double.tryParse(_amount.text.trim()) ?? 0;
    if (amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(t.x('err.enter_valid_amount')),
          backgroundColor: AppColors.warning,
        ),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      await widget.submit(amount, _note.text.trim());
      if (mounted) {
        if (widget.successMsg != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(widget.successMsg!),
              backgroundColor: AppColors.success,
            ),
          );
        }
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e'), backgroundColor: AppColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    return AlertDialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppTokens.radius),
      ),
      title: Text(widget.title),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _amount,
            keyboardType: TextInputType.number,
            autofocus: true,
            decoration: InputDecoration(
              labelText: t.x('wallet.amount'),
              prefixIcon: const Icon(Icons.currency_rupee, size: 18),
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _note,
            decoration: InputDecoration(
              labelText: t.x('wallet.note'),
              border: const OutlineInputBorder(),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.pop(context),
          child: Text(t.x('common.cancel')),
        ),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: AppColors.onPrimary,
          ),
          onPressed: _submitting ? null : _go,
          child: _submitting
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(widget.actionLabel),
        ),
      ],
    );
  }
}

/// Branch cash pool row with a top-up action.
class _BranchRow extends ConsumerWidget {
  const _BranchRow({required this.pool, required this.fmt, required this.t});
  final BranchPool pool;
  final NumberFormat fmt;
  final T t;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final low = pool.balance < 0;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.info.withAlpha(28),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.account_balance, color: AppColors.info),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(pool.branchName,
                    style: AppTypography.bodyLarge
                        .copyWith(fontWeight: FontWeight.w700),),
                const SizedBox(height: 2),
                Text(fmt.format(pool.balance),
                    style: AppTypography.caption.copyWith(
                      color: low ? AppColors.danger : AppColors.success,
                      fontWeight: FontWeight.w700,
                    ),),
              ],
            ),
          ),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.info,
              side: const BorderSide(color: AppColors.info),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
            ),
            onPressed: () => _topUp(context, ref),
            icon: const Icon(Icons.add, size: 16),
            label: Text(t.x('wallet.topup')),
          ),
        ],
      ),
    );
  }

  void _topUp(BuildContext context, WidgetRef ref) {
    showDialog<void>(
      context: context,
      builder: (_) => _AmountActionDialog(
        title: '${t.x('wallet.topup')} — ${pool.branchName}',
        actionLabel: t.x('wallet.topup'),
        successMsg: t.x('wallet.topped_up'),
        submit: (amount, note) async {
          await ref
              .read(walletServiceProvider)
              .injectBranch(branchId: pool.branchId, amount: amount, note: note);
          ref.invalidate(walletBranchesProvider);
        },
      ),
    );
  }
}

class _AgentRow extends ConsumerWidget {
  const _AgentRow({required this.agent, required this.fmt, required this.t});
  final AgentWallet agent;
  final NumberFormat fmt;
  final T t;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: AppColors.primary.withAlpha(30),
            child: Text(
              agent.name.isNotEmpty ? agent.name[0].toUpperCase() : '?',
              style: const TextStyle(
                  color: AppColors.primary, fontWeight: FontWeight.w800,),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(agent.name,
                    style: AppTypography.bodyLarge
                        .copyWith(fontWeight: FontWeight.w700),),
                const SizedBox(height: 2),
                Text('${t.x('wallet.balance')}: ${fmt.format(agent.balance)}',
                    style: AppTypography.caption.copyWith(
                      color: agent.balance > 0
                          ? AppColors.success
                          : AppColors.textSecondary,
                      fontWeight: FontWeight.w700,
                    ),),
              ],
            ),
          ),
          FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: AppColors.onPrimary,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
            onPressed: () => _openRelease(context, ref),
            icon: const Icon(Icons.add_card, size: 16),
            label: Text(t.x('wallet.release')),
          ),
        ],
      ),
    );
  }

  void _openRelease(BuildContext context, WidgetRef ref) {
    showDialog<void>(
      context: context,
      builder: (_) => _ReleaseDialog(agent: agent),
    );
  }
}

class _ReleaseDialog extends ConsumerStatefulWidget {
  const _ReleaseDialog({required this.agent});
  final AgentWallet agent;

  @override
  ConsumerState<_ReleaseDialog> createState() => _ReleaseDialogState();
}

class _ReleaseDialogState extends ConsumerState<_ReleaseDialog> {
  final _amount = TextEditingController();
  final _note = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _amount.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final t = T.of(ref);
    final amount = double.tryParse(_amount.text.trim()) ?? 0;
    if (amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(t.x('err.enter_valid_amount')),
            backgroundColor: AppColors.warning,),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      await ref.read(walletServiceProvider).release(
            agentId: widget.agent.agentId,
            amount: amount,
            note: _note.text.trim(),
          );
      ref.invalidate(walletAgentsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(t.x('wallet.released')),
              backgroundColor: AppColors.success,),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e'), backgroundColor: AppColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    return AlertDialog(
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTokens.radius),),
      title: Text('${t.x('wallet.release')} — ${widget.agent.name}'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _amount,
            keyboardType: TextInputType.number,
            autofocus: true,
            decoration: InputDecoration(
              labelText: t.x('wallet.amount'),
              prefixIcon: const Icon(Icons.currency_rupee, size: 18),
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _note,
            decoration: InputDecoration(
              labelText: t.x('wallet.note'),
              border: const OutlineInputBorder(),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.pop(context),
          child: Text(t.x('common.cancel')),
        ),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: AppColors.onPrimary,
          ),
          onPressed: _submitting ? null : _submit,
          child: _submitting
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(t.x('wallet.release')),
        ),
      ],
    );
  }
}

class _TxnTile extends StatelessWidget {
  const _TxnTile({required this.tx, required this.fmt, required this.t});
  final WalletTxn tx;
  final NumberFormat fmt;
  final T t;

  @override
  Widget build(BuildContext context) {
    final credit = tx.isCredit;
    final color = credit ? AppColors.success : AppColors.danger;
    final icon = switch (tx.type) {
      'release' => Icons.add_card,
      'collection' => Icons.payments_outlined,
      'disburse' => Icons.call_made,
      'inject' => Icons.account_balance,
      _ => Icons.swap_horiz,
    };
    final label = t.x('wallet.txn_${tx.type}');
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: color.withAlpha(28),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 18, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label == 'wallet.txn_${tx.type}' ? tx.type : label,
                    style: AppTypography.body
                        .copyWith(fontWeight: FontWeight.w600),),
                Text(
                  DateFormat('d MMM, h:mm a').format(tx.createdAt),
                  style: AppTypography.extraTiny,
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${credit ? '+' : ''}${fmt.format(tx.amount)}',
                style: AppTypography.bodyLarge
                    .copyWith(color: color, fontWeight: FontWeight.w800),
              ),
              Text(fmt.format(tx.balanceAfter), style: AppTypography.extraTiny),
            ],
          ),
        ],
      ),
    );
  }
}
