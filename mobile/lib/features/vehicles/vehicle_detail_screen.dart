import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/vehicle.dart';
import 'package:loantrack/data/services/vehicles_service.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';
import 'package:loantrack/shared/widgets/skeleton.dart';

// ── Provider ────────────────────────────────────────────────────────────────

final _vehicleDetailProvider =
    FutureProvider.autoDispose.family<Vehicle, String>((ref, id) {
  return ref.watch(vehiclesServiceProvider).fetchVehicle(id);
});

// ── Screen ───────────────────────────────────────────────────────────────────

class VehicleDetailScreen extends ConsumerStatefulWidget {
  const VehicleDetailScreen({super.key, required this.id});
  final String id;

  @override
  ConsumerState<VehicleDetailScreen> createState() =>
      _VehicleDetailScreenState();
}

class _VehicleDetailScreenState extends ConsumerState<VehicleDetailScreen> {
  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_vehicleDetailProvider(widget.id));
    final t = T.of(ref);

    return Scaffold(
      appBar: AppBar(
        title: Text(t.x('veh.detail')),
        centerTitle: true,
      ),
      body: async.when(
        loading: () => ListView(
          padding: const EdgeInsets.all(16),
          children: const [
            Skeleton(height: 120, borderRadius: 12),
            SizedBox(height: 12),
            Skeleton(height: 180, borderRadius: 12),
            SizedBox(height: 12),
            Skeleton(height: 140, borderRadius: 12),
          ],
        ),
        error: (e, _) => EmptyState(
          icon: Icons.cloud_off,
          title: t.x('err.failed_to_load'),
          subtitle: e.toString(),
        ),
        data: (vehicle) => _VehicleBody(vehicle: vehicle),
      ),
    );
  }
}

// ── Body ─────────────────────────────────────────────────────────────────────

class _VehicleBody extends ConsumerWidget {
  const _VehicleBody({required this.vehicle});
  final Vehicle vehicle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = T.of(ref);
    final dateFmt = DateFormat('dd MMM yyyy');

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        // ── Header card ──────────────────────────────────────────────────
        _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: vehicle.repoFlag
                          ? AppColors.dangerBg
                          : AppColors.primaryLight,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      Icons.directions_car,
                      color: vehicle.repoFlag
                          ? AppColors.danger
                          : AppColors.primary,
                      size: 26,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          vehicle.registrationNo,
                          style: AppTypography.bodyLarge.copyWith(
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1,
                          ),
                        ),
                        Text(
                          '${vehicle.make} ${vehicle.model}'
                              '${vehicle.year != null ? ' • ${vehicle.year}' : ''}',
                          style: AppTypography.caption,
                        ),
                      ],
                    ),
                  ),
                  if (vehicle.repoFlag)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.dangerBg,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        t.x('veh.repoFlag'),
                        style: AppTypography.caption.copyWith(
                          color: AppColors.dangerText,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),

        // ── Vehicle details ──────────────────────────────────────────────
        _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _SectionHeader(t.x('veh.detail')),
              const SizedBox(height: 8),
              _DetailRow(label: t.x('veh.make'), value: vehicle.make),
              _DetailRow(label: t.x('veh.model'), value: vehicle.model),
              if (vehicle.year != null)
                _DetailRow(
                  label: t.x('veh.year'),
                  value: vehicle.year.toString(),
                ),
              if (vehicle.color != null)
                _DetailRow(label: t.x('veh.color'), value: vehicle.color!),
              _DetailRow(label: t.x('veh.type'), value: vehicle.vehicleType),
              if (vehicle.engineNo != null)
                _DetailRow(label: t.x('veh.engine'), value: vehicle.engineNo!),
              if (vehicle.chassisNo != null)
                _DetailRow(
                  label: t.x('veh.chassis'),
                  value: vehicle.chassisNo!,
                ),
              if (vehicle.insuranceExpiry != null)
                _DetailRow(
                  label: t.x('veh.insurance'),
                  value: dateFmt.format(vehicle.insuranceExpiry!),
                  valueColor: vehicle.insuranceExpiry!.isBefore(DateTime.now())
                      ? AppColors.danger
                      : null,
                ),
            ],
          ),
        ),
        const SizedBox(height: 12),

        // ── Customer ─────────────────────────────────────────────────────
        if (vehicle.customer != null)
          _Card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SectionHeader(t.x('veh.customer')),
                const SizedBox(height: 8),
                InkWell(
                  borderRadius: BorderRadius.circular(8),
                  onTap: () =>
                      context.push('/customers/${vehicle.customer!.id}'),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                vehicle.customer!.name,
                                style: AppTypography.bodyLarge,
                              ),
                              Text(
                                vehicle.customer!.customerCode,
                                style: AppTypography.caption,
                              ),
                              if (vehicle.customer!.phone != null)
                                Text(
                                  vehicle.customer!.phone!,
                                  style: AppTypography.caption,
                                ),
                            ],
                          ),
                        ),
                        Icon(
                          Icons.chevron_right,
                          color: AppColors.primary,
                          size: 20,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        if (vehicle.customer != null) const SizedBox(height: 12),

        // ── Loan ─────────────────────────────────────────────────────────
        if (vehicle.loan != null)
          _Card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SectionHeader(t.x('veh.loan')),
                const SizedBox(height: 8),
                InkWell(
                  borderRadius: BorderRadius.circular(8),
                  onTap: () =>
                      context.push('/loans/${vehicle.loan!.id}'),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                vehicle.loan!.loanCode ?? vehicle.loan!.id,
                                style: AppTypography.bodyLarge.copyWith(
                                  fontFamily: 'monospace',
                                ),
                              ),
                              if (vehicle.loan!.status != null)
                                Text(
                                  vehicle.loan!.status!,
                                  style: AppTypography.caption,
                                ),
                            ],
                          ),
                        ),
                        Icon(
                          Icons.chevron_right,
                          color: AppColors.primary,
                          size: 20,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        if (vehicle.loan != null) const SizedBox(height: 12),

        // ── Repo info ─────────────────────────────────────────────────────
        if (vehicle.repoFlag)
          _Card(
            borderColor: AppColors.dangerBg,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.flag, color: AppColors.danger, size: 16),
                    const SizedBox(width: 6),
                    Text(
                      t.x('veh.repoFlag'),
                      style: AppTypography.bodyLarge.copyWith(
                        color: AppColors.dangerText,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                if (vehicle.repoFlaggedAt != null)
                  _DetailRow(
                    label: t.x('veh.flagged'),
                    value: dateFmt.format(vehicle.repoFlaggedAt!),
                  ),
                if (vehicle.repoFlaggedBy != null)
                  _DetailRow(
                    label: t.x('veh.by'),
                    value: vehicle.repoFlaggedBy!.name ?? vehicle.repoFlaggedBy!.id,
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

// ── Shared widgets ────────────────────────────────────────────────────────────

class _Card extends StatelessWidget {
  const _Card({required this.child, this.borderColor});
  final Widget child;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        border: borderColor != null
            ? Border.all(color: borderColor!, width: 1.5)
            : null,
        boxShadow: AppTokens.shadow,
      ),
      child: child,
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.title);
  final String title;

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: AppTypography.caption.copyWith(
        color: AppColors.textSecondary,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.4,
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.label,
    required this.value,
    this.valueColor,
  });
  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(label, style: AppTypography.caption),
          ),
          Expanded(
            child: Text(
              value,
              style: AppTypography.bodyLarge.copyWith(
                color: valueColor,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
