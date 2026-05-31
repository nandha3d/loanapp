import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/vehicle.dart';
import 'package:loantrack/data/services/vehicles_service.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

// ── Provider ────────────────────────────────────────────────────────────────

final _vehiclesQueryProvider = StateProvider.autoDispose<String>((ref) => '');

final _vehiclesProvider =
    FutureProvider.autoDispose<List<Vehicle>>((ref) {
  final q = ref.watch(_vehiclesQueryProvider);
  return ref.watch(vehiclesServiceProvider).fetchVehicles(q: q.isEmpty ? null : q);
});

// ── Screen ───────────────────────────────────────────────────────────────────

class VehiclesScreen extends ConsumerStatefulWidget {
  const VehiclesScreen({super.key});

  @override
  ConsumerState<VehiclesScreen> createState() => _VehiclesScreenState();
}

class _VehiclesScreenState extends ConsumerState<VehiclesScreen> {
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onSearch(String value) {
    ref.read(_vehiclesQueryProvider.notifier).state = value.trim();
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_vehiclesProvider);
    final t = T.of(ref);

    return Scaffold(
      appBar: AppBar(
        title: Text(t.x('veh.title')),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/dashboard'),
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: TextField(
              controller: _searchCtrl,
              onChanged: (v) {
                setState(() {});
                _onSearch(v);
              },
              decoration: InputDecoration(
                hintText: t.x('veh.search'),
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchCtrl.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchCtrl.clear();
                          _onSearch('');
                        },
                      )
                    : null,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppTokens.radius),
                ),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
              ),
            ),
          ),
          Expanded(
            child: async.when(
              loading: () => ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: 6,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, __) =>
                    const Skeleton(height: 76, borderRadius: 12),
              ),
              error: (e, _) => EmptyState(
                icon: Icons.cloud_off,
                title: t.x('err.failed_to_load'),
                subtitle: e.toString(),
              ),
              data: (vehicles) => vehicles.isEmpty
                  ? EmptyState(
                      icon: Icons.directions_car_outlined,
                      title: t.x('veh.noVehicles'),
                    )
                  : RefreshIndicator(
                      color: AppColors.primary,
                      onRefresh: () async =>
                          ref.refresh(_vehiclesProvider.future),
                      child: ListView.separated(
                        padding:
                            const EdgeInsets.fromLTRB(16, 8, 16, 24),
                        itemCount: vehicles.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: 8),
                        itemBuilder: (_, i) => _VehicleTile(
                          vehicle: vehicles[i],
                          onTap: () =>
                              context.push('/vehicles/${vehicles[i].id}'),
                        ),
                      ),
                    ),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: Text(t.x('veh.new_title')),
        onPressed: () async {
          final created = await context.push<Object?>('/vehicles/new');
          if (created == true) ref.invalidate(_vehiclesProvider);
        },
      ),
    );
  }
}

// ── Tile ─────────────────────────────────────────────────────────────────────

class _VehicleTile extends ConsumerWidget {
  const _VehicleTile({required this.vehicle, required this.onTap});
  final Vehicle vehicle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);

    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppTokens.radius),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppTokens.radius),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTokens.radius),
            boxShadow: AppTokens.shadow,
          ),
          child: Row(
            children: [
              // Vehicle icon with repo indicator
              Stack(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: vehicle.repoFlag
                          ? AppColors.dangerBg
                          : AppColors.primaryLight,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      Icons.directions_car,
                      color: vehicle.repoFlag
                          ? AppColors.danger
                          : AppColors.primary,
                      size: 22,
                    ),
                  ),
                  if (vehicle.repoFlag)
                    Positioned(
                      right: 0,
                      top: 0,
                      child: Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(
                          color: AppColors.danger,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: AppColors.surface,
                            width: 1.5,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 12),
              // Details
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      vehicle.registrationNo,
                      style: AppTypography.bodyLarge.copyWith(
                        fontFamily: 'monospace',
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${vehicle.make} ${vehicle.model}'
                          '${vehicle.year != null ? ' (${vehicle.year})' : ''}',
                      style: AppTypography.caption,
                    ),
                    if (vehicle.customer != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        vehicle.customer!.name,
                        style: AppTypography.caption.copyWith(
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              // Repo badge
              if (vehicle.repoFlag)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.dangerBg,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    t.x('veh.repoFlag'),
                    style: AppTypography.caption.copyWith(
                      color: AppColors.dangerText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                )
              else
                const Icon(
                  Icons.chevron_right,
                  color: Colors.grey,
                  size: 20,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
