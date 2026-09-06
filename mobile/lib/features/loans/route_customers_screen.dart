import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:zolofund/core/currency/currency_controller.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/services/loan_service.dart';
import 'package:zolofund/shared/widgets/bottom_nav.dart';
import 'package:zolofund/shared/widgets/empty_state.dart';
import 'package:zolofund/shared/widgets/skeleton.dart';

/// Auto Finance Route / Area Manager.
///
/// Field agents work a geographical beat, not an alphabetical customer list.
/// This screen groups the agent's active accounts by collection route so they
/// can open "100 Feet Road" and see everyone due on that street, with one-tap
/// call and WhatsApp on each row.
final _routeLoansProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.watch(loanServiceProvider).list();
});

/// A route bucket with its accounts and the money outstanding on it.
class _RouteBucket {
  _RouteBucket(this.name);
  final String name;
  final List<Map<String, dynamic>> loans = [];
  double dueNow = 0;
}

double _outstandingOf(Map<String, dynamic> loan) {
  final payable = (loan['totalPayable'] as num?)?.toDouble() ?? 0;
  final collected = (loan['totalCollected'] as num?)?.toDouble() ?? 0;
  final balance = payable - collected;
  return balance > 0 ? balance : 0;
}

bool _isOpen(Map<String, dynamic> loan) {
  final status = (loan['status'] as String?) ?? '';
  return status != 'closed' && status != 'settled' && status != 'pending_review';
}

Map<String, dynamic>? _customerOf(Map<String, dynamic> loan) =>
    loan['customer'] as Map<String, dynamic>?;

String _routeNameOf(Map<String, dynamic> loan) {
  final route = _customerOf(loan)?['route'] as Map<String, dynamic>?;
  final name = route?['name'] as String?;
  return (name == null || name.trim().isEmpty) ? 'Unassigned' : name;
}

Future<void> _launch(Uri uri, BuildContext context) async {
  if (await canLaunchUrl(uri)) {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  } else if (context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Cannot open ${uri.scheme}')),
    );
  }
}

/// Strips formatting and prefixes the country code WhatsApp expects.
String _waNumber(String phone) {
  final digits = phone.replaceAll(RegExp(r'\D'), '');
  if (digits.length == 10) return '91$digits';
  return digits;
}

class RouteCustomersScreen extends ConsumerWidget {
  const RouteCustomersScreen({super.key, this.routeName});

  /// When set the screen opens straight into that route's customer list.
  final String? routeName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_routeLoansProvider);
    final t = T.of(ref);

    return Scaffold(
      appBar: AppBar(
        title: Text(routeName ?? 'Routes'),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () =>
              routeName == null ? context.go('/dashboard') : context.pop(),
        ),
      ),
      bottomNavigationBar: const AppBottomNav(currentRoute: '/loans'),
      body: async.when(
        loading: () => ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: 6,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, __) => const Skeleton(height: 76, borderRadius: 12),
        ),
        error: (e, _) => EmptyState(
          icon: Icons.cloud_off,
          title: t.x('err.failed_to_load'),
          subtitle: '$e',
        ),
        data: (rows) {
          final open = rows.where(_isOpen).toList();

          if (routeName != null) {
            final mine = open.where((l) => _routeNameOf(l) == routeName).toList()
              ..sort((a, b) => _outstandingOf(b).compareTo(_outstandingOf(a)));
            return _CustomerList(loans: mine);
          }

          final buckets = <String, _RouteBucket>{};
          for (final loan in open) {
            final name = _routeNameOf(loan);
            final bucket = buckets.putIfAbsent(name, () => _RouteBucket(name));
            bucket.loans.add(loan);
            bucket.dueNow += _outstandingOf(loan);
          }

          final ordered = buckets.values.toList()
            ..sort((a, b) {
              // Keep "Unassigned" last; otherwise biggest book first.
              if (a.name == 'Unassigned') return 1;
              if (b.name == 'Unassigned') return -1;
              return b.dueNow.compareTo(a.dueNow);
            });

          if (ordered.isEmpty) {
            return const EmptyState(
              icon: Icons.map_outlined,
              title: 'No routes yet',
              subtitle: 'Active accounts grouped by collection route appear here.',
            );
          }

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(_routeLoansProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: ordered.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) => _RouteTile(bucket: ordered[i]),
            ),
          );
        },
      ),
    );
  }
}

class _RouteTile extends ConsumerWidget {
  const _RouteTile({required this.bucket});
  final _RouteBucket bucket;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fmt = ref.watch(currencyFmtProvider);
    return Material(
      color: Theme.of(context).cardColor,
      borderRadius: BorderRadius.circular(AppTokens.radius),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppTokens.radius),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => RouteCustomersScreen(routeName: bucket.name),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                child: Icon(Icons.map_outlined, color: AppColors.primary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(bucket.name, style: AppTypography.bodyLarge),
                    const SizedBox(height: 2),
                    Text(
                      '${bucket.loans.length} account(s)',
                      style: AppTypography.bodySmall,
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(fmt.format(bucket.dueNow), style: AppTypography.bodyLarge),
                  Text('outstanding', style: AppTypography.bodySmall),
                ],
              ),
              const Icon(Icons.chevron_right),
            ],
          ),
        ),
      ),
    );
  }
}

class _CustomerList extends ConsumerWidget {
  const _CustomerList({required this.loans});
  final List<Map<String, dynamic>> loans;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fmt = ref.watch(currencyFmtProvider);

    if (loans.isEmpty) {
      return const EmptyState(
        icon: Icons.people_outline,
        title: 'No accounts on this route',
        subtitle: 'Every account here is settled.',
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: loans.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) {
        final loan = loans[i];
        final customer = _customerOf(loan);
        final vehicle = loan['vehicle'] as Map<String, dynamic>?;
        final phone = (customer?['phone'] as String?) ?? '';
        final outstanding = _outstandingOf(loan);
        final seized = vehicle?['repoFlag'] == true;

        return Material(
          color: Theme.of(context).cardColor,
          borderRadius: BorderRadius.circular(AppTokens.radius),
          child: InkWell(
            borderRadius: BorderRadius.circular(AppTokens.radius),
            onTap: () => context.push('/loans/${loan['id']}'),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                (customer?['name'] as String?) ?? '—',
                                style: AppTypography.bodyLarge,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (seized) ...[
                              const SizedBox(width: 6),
                              const Icon(
                                Icons.car_crash,
                                size: 16,
                                color: AppColors.danger,
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          vehicle?['registrationNo'] as String? ??
                              (loan['loanCode'] as String? ?? ''),
                          style: AppTypography.bodySmall,
                        ),
                        const SizedBox(height: 4),
                        Text(fmt.format(outstanding), style: AppTypography.bodyLarge),
                      ],
                    ),
                  ),
                  if (phone.isNotEmpty) ...[
                    IconButton(
                      tooltip: 'Call',
                      icon: Icon(Icons.call, color: AppColors.primary),
                      onPressed: () => _launch(Uri.parse('tel:$phone'), context),
                    ),
                    IconButton(
                      tooltip: 'WhatsApp',
                      icon: const Icon(Icons.chat, color: Color(0xFF25D366)),
                      onPressed: () => _launch(
                        Uri.parse('https://wa.me/${_waNumber(phone)}'),
                        context,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
