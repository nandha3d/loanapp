import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import 'package:loantrack/core/auth/auth_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/route_model.dart';
import 'package:loantrack/data/services/settings_service.dart';
import 'package:loantrack/data/services/upload_service.dart';
import 'package:loantrack/shared/widgets/app_button.dart';
import 'package:loantrack/shared/widgets/empty_state.dart';

final _routesProvider = FutureProvider.autoDispose<List<AppRoute>>(
  (ref) => ref.watch(settingsServiceProvider).routes(),
);
final _packagesProvider = FutureProvider.autoDispose<List<LoanPackage>>(
  (ref) => ref.watch(settingsServiceProvider).packages(),
);

class RoutesScreen extends ConsumerWidget {
  const RoutesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_routesProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Routes'), centerTitle: true),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (list) => list.isEmpty
            ? const EmptyState(icon: Icons.alt_route, title: 'No routes')
            : RefreshIndicator(
                color: AppColors.primary,
                onRefresh: () async => ref.invalidate(_routesProvider),
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: list.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final r = list[i];
                    return _row(
                      title: r.name,
                      subtitle:
                          '${r.customerCount} customers • ${r.agentName ?? 'Unassigned'}',
                    );
                  },
                ),
              ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        onPressed: () => _showCreate(context, ref),
        label: const Text('New Route'),
        icon: const Icon(Icons.add),
      ),
    );
  }

  Widget _row({required String title, required String subtitle}) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AppTypography.bodyLarge),
          const SizedBox(height: 2),
          Text(subtitle, style: AppTypography.caption),
        ],
      ),
    );
  }

  Future<void> _showCreate(BuildContext context, WidgetRef ref) async {
    final ctrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('New Route'),
        content: TextField(
          controller: ctrl,
          decoration: const InputDecoration(labelText: 'Route name'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Create'),
          ),
        ],
      ),
    );
    if (ok != true || ctrl.text.trim().isEmpty) return;
    try {
      await ref
          .read(settingsServiceProvider)
          .createRoute(name: ctrl.text.trim());
      ref.invalidate(_routesProvider);
    } on Object catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('$e')));
    }
  }
}

class PackagesScreen extends ConsumerWidget {
  const PackagesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_packagesProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Loan Packages'), centerTitle: true),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (list) => list.isEmpty
            ? const EmptyState(
                icon: Icons.inventory_2_outlined, title: 'No packages')
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: list.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final p = list[i];
                  return Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(AppTokens.radius),
                      boxShadow: AppTokens.shadow,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(p.name, style: AppTypography.bodyLarge),
                        const SizedBox(height: 4),
                        Text(
                          '₹${p.principal.toStringAsFixed(0)} • '
                          '${p.tenure} × ${p.frequency} • '
                          '₹${p.perInstalment.toStringAsFixed(0)}/inst',
                          style: AppTypography.bodySmall.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),
                        Text(
                          'Penalty: ${p.penaltyRate.toStringAsFixed(2)}%',
                          style: AppTypography.caption,
                        ),
                      ],
                    ),
                  );
                },
              ),
      ),
    );
  }
}

class PenaltyRateScreen extends ConsumerStatefulWidget {
  const PenaltyRateScreen({super.key});
  @override
  ConsumerState<PenaltyRateScreen> createState() => _PenaltyRateScreenState();
}

class _PenaltyRateScreenState extends ConsumerState<PenaltyRateScreen> {
  final _ctrl = TextEditingController(text: '1.5');
  bool _busy = false;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Penalty Rate'), centerTitle: true),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            TextField(
              controller: _ctrl,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Default penalty rate',
                suffixText: '% per day',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            AppButton(
              label: 'Save',
              expand: true,
              loading: _busy,
              onPressed: _busy ? null : _save,
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _save() async {
    final value = double.tryParse(_ctrl.text.trim());
    if (value == null) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(settingsServiceProvider)
          .save({'defaultPenaltyRate': value});
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Saved')));
    } on Object catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

class UpiQrScreen extends ConsumerStatefulWidget {
  const UpiQrScreen({super.key});
  @override
  ConsumerState<UpiQrScreen> createState() => _UpiQrScreenState();
}

class _UpiQrScreenState extends ConsumerState<UpiQrScreen> {
  String? _pickedPath;
  bool _busy = false;

  Future<void> _pick() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: ImageSource.gallery);
    if (file != null) setState(() => _pickedPath = file.path);
  }

  Future<void> _upload() async {
    if (_pickedPath == null) return;
    setState(() => _busy = true);
    try {
      final result = await ref
          .read(uploadServiceProvider)
          .uploadFile(File(_pickedPath!));
      await ref
          .read(settingsServiceProvider)
          .save({'upiQrUrl': result.url});
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Uploaded')));
    } on Object catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('UPI QR Code'), centerTitle: true),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Container(
              height: 240,
              decoration: BoxDecoration(
                color: AppColors.surface,
                border: Border.all(color: AppColors.border),
                borderRadius: BorderRadius.circular(AppTokens.radius),
              ),
              alignment: Alignment.center,
              child: _pickedPath == null
                  ? const Text('No image selected')
                  : Image.file(File(_pickedPath!), fit: BoxFit.contain),
            ),
            const SizedBox(height: 16),
            AppButton(
              label: 'Choose Image',
              variant: AppButtonVariant.secondary,
              expand: true,
              onPressed: _pick,
            ),
            const SizedBox(height: 10),
            AppButton(
              label: 'Upload',
              expand: true,
              loading: _busy,
              onPressed: _pickedPath == null || _busy ? null : _upload,
            ),
          ],
        ),
      ),
    );
  }
}

class TwoFactorScreen extends ConsumerWidget {
  const TwoFactorScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final enabled = user?.totpEnabled ?? false;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('2FA'), centerTitle: true),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(AppTokens.radius),
              boxShadow: AppTokens.shadow,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  enabled
                      ? 'Two-factor authentication is enabled'
                      : 'Two-factor authentication is disabled',
                  style: AppTypography.bodyLarge,
                ),
                const SizedBox(height: 8),
                Text(
                  'Manage TOTP from the web app — open Settings → Security.',
                  style: AppTypography.bodySmall
                      .copyWith(color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class UserManagementStub extends StatelessWidget {
  const UserManagementStub({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar:
          AppBar(title: const Text('User Management'), centerTitle: true),
      body: const EmptyState(
        icon: Icons.manage_accounts_outlined,
        title: 'Manage users from the web app',
        subtitle:
            'Mobile user management is intentionally read-only for safety.',
      ),
    );
  }
}
