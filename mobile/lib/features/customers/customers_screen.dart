import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/repositories/customer_repository.dart';
import 'package:loantrack/features/customers/widgets/customer_tile.dart';
import 'package:loantrack/features/customers/widgets/filter_pill.dart';
import 'package:loantrack/shared/widgets/bottom_nav.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';
import 'package:loantrack/shared/widgets/fab_extended.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

class CustomersScreen extends ConsumerStatefulWidget {
  const CustomersScreen({super.key});

  @override
  ConsumerState<CustomersScreen> createState() => _CustomersScreenState();
}

class _StatusOpt {
  const _StatusOpt(this.key, this.label);
  final String key;
  final String label;
}

class _CustomersScreenState extends ConsumerState<CustomersScreen> {
  final _searchCtrl = TextEditingController();
  Timer? _debounce;

  static const List<_StatusOpt> _statuses = [
    _StatusOpt('all', 'status.all'),
    _StatusOpt('active', 'status.active'),
    _StatusOpt('pending_review', 'status.pending'),
    _StatusOpt('suspended', 'status.suspended'),
  ];

  @override
  void dispose() {
    _searchCtrl.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      ref
          .read(customerFilterProvider.notifier)
          .update((s) => s.copyWith(query: value.trim()));
    });
  }

  @override
  Widget build(BuildContext context) {
    final filter = ref.watch(customerFilterProvider);
    final listAsync = ref.watch(customerListProvider);
    final t = T.of(ref);

    return Scaffold(
      appBar: AppBar(
        title: Text(t.x('title.customers')),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/dashboard'),
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              controller: _searchCtrl,
              onChanged: _onSearchChanged,
              style: AppTypography.body,
              decoration: InputDecoration(
                hintText: t.x('fld.search_customer_full'),
                hintStyle: AppTypography.body.copyWith(
                  color: AppColors.textLight,
                ),
                prefixIcon: const Icon(
                  Icons.search,
                  size: 18,
                  color: AppColors.textLight,
                ),
                suffixIcon: _searchCtrl.text.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.close, size: 18),
                        onPressed: () {
                          _searchCtrl.clear();
                          _onSearchChanged('');
                        },
                      ),
              ),
            ),
          ),
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                for (final opt in _statuses) ...[
                  FilterPill(
                    label: t.x(opt.label),
                    selected: filter.status == opt.key,
                    onTap: () => ref
                        .read(customerFilterProvider.notifier)
                        .update((s) => s.copyWith(status: opt.key)),
                  ),
                  const SizedBox(width: 8),
                ],
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              color: AppColors.primary,
              onRefresh: () async =>
                  ref.refresh(customerListProvider.future),
              child: listAsync.when(
                loading: () => ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: 6,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, __) =>
                      const Skeleton(height: 72, borderRadius: 12),
                ),
                error: (err, _) => ListView(
                  children: [
                    const SizedBox(height: 80),
                    EmptyState(
                      icon: Icons.cloud_off,
                      title: t.x('err.could_not_load_customers'),
                      subtitle: err.toString(),
                    ),
                  ],
                ),
                data: (customers) => customers.isEmpty
                    ? ListView(
                        children: [
                          const SizedBox(height: 80),
                          EmptyState(
                            icon: Icons.people_outline,
                            title: t.x('empty.no_customers'),
                            subtitle: t.x('empty.tap_add_below'),
                          ),
                        ],
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                        itemCount: customers.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: 8),
                        itemBuilder: (_, i) => CustomerTile(
                          customer: customers[i],
                          onTap: () =>
                              context.push('/customers/${customers[i].id}'),
                        ),
                      ),
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: FabExtended(
        icon: Icons.person_add_alt_1,
        label: t.x('btn.add_customer'),
        onPressed: () => context.push('/customers/new'),
      ),
      bottomNavigationBar: const AppBottomNav(currentRoute: '/customers'),
    );
  }
}
