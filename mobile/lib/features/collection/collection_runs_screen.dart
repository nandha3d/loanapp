import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:zolofund/core/gps/gps_service.dart';
import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/collection_run.dart';
import 'package:zolofund/data/services/collection_run_service.dart';
import 'package:zolofund/shared/widgets/bottom_nav.dart';
import 'package:zolofund/shared/widgets/empty_state.dart';
import 'package:zolofund/shared/widgets/skeleton.dart';

/// RUN-01: active routes + last 50 runs from GET /collection/run (web parity).
final _runsProvider = FutureProvider.autoDispose((ref) {
  return ref.watch(collectionRunServiceProvider).listRuns();
});

/// mCollect-A — pick a route and open a batch collection run.
class CollectionRunsScreen extends ConsumerStatefulWidget {
  const CollectionRunsScreen({super.key});

  @override
  ConsumerState<CollectionRunsScreen> createState() =>
      _CollectionRunsScreenState();
}

class _CollectionRunsScreenState extends ConsumerState<CollectionRunsScreen> {
  String? _openingRouteId;

  Future<void> _start(String routeId) async {
    setState(() => _openingRouteId = routeId);
    try {
      // RUN-01: the open position travels with the run, as on web.
      final pos = await ref.read(gpsServiceProvider).currentOrLastKnown();
      final run = await ref
          .read(collectionRunServiceProvider)
          .openRun(routeId: routeId, lat: pos?.latitude, lng: pos?.longitude);
      if (!mounted) return;
      context.push('/collection/runs/${run.id}');
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(e.toString()), backgroundColor: AppColors.danger,),
      );
    } finally {
      if (mounted) setState(() => _openingRouteId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final runsAsync = ref.watch(_runsProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Collection Runs'), centerTitle: true),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async {
          ref.invalidate(_runsProvider);
          await ref.read(_runsProvider.future);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(AppTokens.radius),
              ),
              child: Text(
                'Open a run for your route, collect every due customer on one sheet, then deposit the day’s cash.',
                style:
                    AppTypography.body.copyWith(color: AppColors.textSecondary),
              ),
            ),
            const SizedBox(height: 16),
            Text('Your routes', style: AppTypography.sectionTitle),
            const SizedBox(height: 8),
            runsAsync.when(
              loading: () => const Skeleton(height: 160),
              error: (e, _) => Text(e.toString(),
                  style: AppTypography.body.copyWith(color: AppColors.danger),),
              data: (data) => Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (data.routes.isEmpty)
                    const EmptyState(
                        icon: Icons.route_outlined, title: 'No routes assigned',)
                  else
                    ...data.routes.map((r) => _RouteTile(
                          name: r.name,
                          busy: _openingRouteId == r.id,
                          onTap: () => _start(r.id),
                        ),),
                  if (data.runs.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Text('Recent runs', style: AppTypography.sectionTitle),
                    const SizedBox(height: 8),
                    ...data.runs.map((run) => _RunTile(
                          run: run,
                          routeName: data.routes
                              .where((r) => r.id == run.routeId)
                              .map((r) => r.name)
                              .firstOrNull,
                        ),),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: const AppBottomNav(currentRoute: '/collection'),
    );
  }
}

class _RunTile extends StatelessWidget {
  const _RunTile({required this.run, this.routeName});
  final CollectionRun run;
  final String? routeName;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Text('${run.day}${routeName != null ? ' · $routeName' : ''}',
            style: AppTypography.bodyLarge),
        subtitle: Text('${run.status} · ${run.stopsCollected}/${run.stopsExpected}',
            style: AppTypography.caption),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => context.push('/collection/runs/${run.id}'),
      ),
    );
  }
}

class _RouteTile extends StatelessWidget {
  const _RouteTile(
      {required this.name, required this.busy, required this.onTap,});
  final String name;
  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        leading: CircleAvatar(
          backgroundColor: AppColors.primaryLight,
          child: Icon(Icons.route_rounded, color: AppColors.primary),
        ),
        title: Text(name, style: AppTypography.bodyLarge),
        trailing: busy
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),)
            : Icon(Icons.play_circle_fill_rounded,
                color: AppColors.primary, size: 30,),
        onTap: busy ? null : onTap,
      ),
    );
  }
}
