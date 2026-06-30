import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/superadmin_profile.dart';
import 'package:loantrack/data/services/profile_service.dart';
import 'package:loantrack/shared/widgets/app_button.dart';

class SuperadminProfileScreen extends ConsumerStatefulWidget {
  const SuperadminProfileScreen({super.key});

  @override
  ConsumerState<SuperadminProfileScreen> createState() =>
      _SuperadminProfileScreenState();
}

class _SuperadminProfileScreenState
    extends ConsumerState<SuperadminProfileScreen> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  final _passwordController = TextEditingController();

  SuperadminProfile? _profile;
  bool _loading = true;
  bool _saving = false;
  bool _passwordBusy = false;
  bool _otpSent = false;
  String _error = '';
  String _message = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _otpController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final profile = await ref.read(profileServiceProvider).getProfile();
      _nameController.text = profile.account.name;
      _phoneController.text = profile.account.phone;
      setState(() {
        _profile = profile;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _saveProfile() async {
    setState(() {
      _saving = true;
      _message = '';
      _error = '';
    });
    try {
      final profile = await ref.read(profileServiceProvider).updateProfile(
            name: _nameController.text.trim(),
            phone: _phoneController.text.trim(),
          );
      setState(() {
        _profile = profile;
        _message = 'Profile updated';
        _saving = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _saving = false;
      });
    }
  }

  Future<void> _sendOtp() async {
    setState(() {
      _passwordBusy = true;
      _message = '';
      _error = '';
    });
    try {
      await ref.read(profileServiceProvider).sendPasswordOtp();
      setState(() {
        _otpSent = true;
        _message = 'OTP sent to your account email';
        _passwordBusy = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _passwordBusy = false;
      });
    }
  }

  Future<void> _changePassword() async {
    setState(() {
      _passwordBusy = true;
      _message = '';
      _error = '';
    });
    try {
      await ref.read(profileServiceProvider).changePassword(
            otp: _otpController.text.trim(),
            newPassword: _passwordController.text,
          );
      _otpController.clear();
      _passwordController.clear();
      setState(() {
        _otpSent = false;
        _message = 'Password changed';
        _passwordBusy = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _passwordBusy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = _profile;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Superadmin Profile'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loading ? null : _load,
          ),
        ],
      ),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : profile == null
                ? _ErrorView(error: _error, onRetry: _load)
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        _HeroCard(profile: profile),
                        if (_message.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          _Banner(text: _message, isError: false),
                        ],
                        if (_error.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          _Banner(text: _error, isError: true),
                        ],
                        const SizedBox(height: 16),
                        _DetailsCard(
                          profile: profile,
                          nameController: _nameController,
                          phoneController: _phoneController,
                          saving: _saving,
                          onSave: _saveProfile,
                        ),
                        const SizedBox(height: 16),
                        _PasswordCard(
                          otpController: _otpController,
                          passwordController: _passwordController,
                          otpSent: _otpSent,
                          busy: _passwordBusy,
                          onSendOtp: _sendOtp,
                          onChangePassword: _changePassword,
                        ),
                        const SizedBox(height: 16),
                        _SubscriptionCard(profile: profile),
                        const SizedBox(height: 16),
                        _InvoiceCard(invoices: profile.invoices),
                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
      ),
    );
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.profile});

  final SuperadminProfile profile;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.ink,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadowLg,
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 30,
            backgroundColor: AppColors.primary,
            child: Text(
              _initials(profile.account.name),
              style: AppTypography.nameLg.copyWith(color: Colors.white),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  profile.account.name,
                  style: AppTypography.sectionTitle.copyWith(
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  profile.account.email ?? 'No email on file',
                  style: AppTypography.caption.copyWith(
                    color: Colors.white70,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _StatusChip(
                      label: profile.account.role.toUpperCase(),
                      color: AppColors.primary,
                      textColor: Colors.white,
                    ),
                    _StatusChip(
                      label: profile.tenant.slug,
                      color: Colors.white12,
                      textColor: Colors.white,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailsCard extends StatelessWidget {
  const _DetailsCard({
    required this.profile,
    required this.nameController,
    required this.phoneController,
    required this.saving,
    required this.onSave,
  });

  final SuperadminProfile profile;
  final TextEditingController nameController;
  final TextEditingController phoneController;
  final bool saving;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    return _Section(
      title: 'Basic Details',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: nameController,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(
              labelText: 'Name',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: phoneController,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(
              labelText: 'Phone',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 14),
          _InfoGrid(
            children: [
              _InfoItem(label: 'Username', value: profile.account.username),
              _InfoItem(label: 'Status', value: profile.account.status),
              _InfoItem(label: 'Branch', value: profile.account.branchName ?? 'All branches'),
              _InfoItem(label: 'Last login', value: _date(profile.account.lastLoginAt)),
            ],
          ),
          const SizedBox(height: 14),
          AppButton(
            label: saving ? 'Saving' : 'Save Details',
            loading: saving,
            leading: const Icon(Icons.save_outlined),
            onPressed: saving ? null : onSave,
            expand: true,
          ),
        ],
      ),
    );
  }
}

class _PasswordCard extends StatelessWidget {
  const _PasswordCard({
    required this.otpController,
    required this.passwordController,
    required this.otpSent,
    required this.busy,
    required this.onSendOtp,
    required this.onChangePassword,
  });

  final TextEditingController otpController;
  final TextEditingController passwordController;
  final bool otpSent;
  final bool busy;
  final VoidCallback onSendOtp;
  final VoidCallback onChangePassword;

  @override
  Widget build(BuildContext context) {
    return _Section(
      title: 'Password Change',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Send a mail OTP to verify the password change.',
            style: AppTypography.caption,
          ),
          const SizedBox(height: 12),
          AppButton(
            label: busy && !otpSent ? 'Sending OTP' : 'Send Email OTP',
            loading: busy && !otpSent,
            leading: const Icon(Icons.mail_outline),
            variant: AppButtonVariant.secondary,
            onPressed: busy ? null : onSendOtp,
            expand: true,
          ),
          if (otpSent) ...[
            const SizedBox(height: 14),
            TextField(
              controller: otpController,
              keyboardType: TextInputType.number,
              maxLength: 6,
              decoration: const InputDecoration(
                labelText: 'OTP',
                counterText: '',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: passwordController,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'New password',
                helperText: 'At least 8 characters',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 14),
            AppButton(
              label: busy ? 'Changing' : 'Change Password',
              loading: busy,
              leading: const Icon(Icons.lock_reset_outlined),
              onPressed: busy ? null : onChangePassword,
              expand: true,
            ),
          ],
        ],
      ),
    );
  }
}

class _SubscriptionCard extends StatelessWidget {
  const _SubscriptionCard({required this.profile});

  final SuperadminProfile profile;

  @override
  Widget build(BuildContext context) {
    final sub = profile.subscription;
    return _Section(
      title: 'Subscription Plan',
      child: sub == null
          ? Text('No subscription found.', style: AppTypography.caption)
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        sub.planLabel,
                        style: AppTypography.nameLg,
                      ),
                    ),
                    _StatusChip(
                      label: sub.status.toUpperCase(),
                      color: sub.status == 'active'
                          ? AppColors.successBg
                          : AppColors.warningBg,
                      textColor: sub.status == 'active'
                          ? AppColors.successText
                          : AppColors.warningText,
                    ),
                  ],
                ),
                if (sub.planDescription != null) ...[
                  const SizedBox(height: 4),
                  Text(sub.planDescription!, style: AppTypography.caption),
                ],
                const SizedBox(height: 14),
                _InfoGrid(
                  children: [
                    _InfoItem(
                      label: 'Monthly',
                      value: _currency(sub.pricing.totalMonthlyPrice),
                    ),
                    _InfoItem(
                      label: 'Trial/Renewal',
                      value: _date(sub.trialEndsAt ?? sub.currentPeriodEnd),
                    ),
                    _InfoItem(
                      label: 'Active loans',
                      value: '${profile.usage.activeLoans}/${profile.usage.limits.activeLoans}',
                    ),
                    _InfoItem(
                      label: 'Agents',
                      value: '${profile.usage.activeAgents}/${profile.usage.limits.agents}',
                    ),
                    _InfoItem(
                      label: 'Branches',
                      value: '${profile.usage.activeBranches}/${profile.usage.limits.branches}',
                    ),
                    _InfoItem(
                      label: 'Plan code',
                      value: sub.plan,
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Text('Enabled Modules', style: AppTypography.bodyLarge),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final module in sub.enabledModules)
                      _StatusChip(
                        label: module.label,
                        color: AppColors.successBg,
                        textColor: AppColors.successText,
                      ),
                  ],
                ),
                const SizedBox(height: 16),
                Text('Add-ons', style: AppTypography.bodyLarge),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final addOn in sub.addOns)
                      _StatusChip(
                        label: addOn.label,
                        color: addOn.enabled
                            ? AppColors.infoBg
                            : AppColors.background,
                        textColor: addOn.enabled
                            ? AppColors.infoText
                            : AppColors.textSecondary,
                        icon: addOn.enabled
                            ? Icons.check_circle_outline
                            : Icons.lock_outline,
                      ),
                  ],
                ),
              ],
            ),
    );
  }
}

class _InvoiceCard extends StatelessWidget {
  const _InvoiceCard({required this.invoices});

  final List<ProfileInvoice> invoices;

  @override
  Widget build(BuildContext context) {
    return _Section(
      title: 'Recent Invoices',
      child: invoices.isEmpty
          ? Text('No invoices found.', style: AppTypography.caption)
          : Column(
              children: [
                for (final invoice in invoices) ...[
                  _InvoiceRow(invoice: invoice),
                  if (invoice != invoices.last)
                    const Divider(height: 18, color: AppColors.border),
                ],
              ],
            ),
    );
  }
}

class _InvoiceRow extends StatelessWidget {
  const _InvoiceRow({required this.invoice});

  final ProfileInvoice invoice;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: AppColors.infoBg,
            borderRadius: BorderRadius.circular(AppTokens.radiusSm),
          ),
          child: const Icon(
            Icons.receipt_long_outlined,
            color: AppColors.info,
            size: 20,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(invoice.billingPeriod, style: AppTypography.bodyLarge),
              Text(
                '${_date(invoice.createdAt)} - due ${_date(invoice.dueDate)}',
                style: AppTypography.caption,
              ),
            ],
          ),
        ),
        const SizedBox(width: 10),
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              _currency(invoice.total == 0 ? invoice.amount : invoice.total),
              style: AppTypography.bodyLarge,
            ),
            Text(invoice.status.toUpperCase(), style: AppTypography.tiny),
          ],
        ),
      ],
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTokens.radius),
        boxShadow: AppTokens.shadow,
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AppTypography.sectionTitle),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _InfoGrid extends StatelessWidget {
  const _InfoGrid({required this.children});

  final List<_InfoItem> children;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth > 520 ? 3 : 2;
        return GridView.count(
          crossAxisCount: columns,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 8,
          mainAxisSpacing: 8,
          childAspectRatio: columns == 3 ? 2.4 : 2.1,
          children: children,
        );
      },
    );
  }
}

class _InfoItem extends StatelessWidget {
  const _InfoItem({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            label,
            style: AppTypography.tiny.copyWith(
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w700,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: AppTypography.bodyLarge,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({
    required this.label,
    required this.color,
    required this.textColor,
    this.icon,
  });

  final String label;
  final Color color;
  final Color textColor;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(AppTokens.radiusBadge),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: textColor),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: AppTypography.tiny.copyWith(
              color: textColor,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.text, required this.isError});

  final String text;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isError ? AppColors.dangerBg : AppColors.successBg,
        borderRadius: BorderRadius.circular(AppTokens.radiusSm),
      ),
      child: Text(
        text,
        style: AppTypography.body.copyWith(
          color: isError ? AppColors.dangerText : AppColors.successText,
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.error, required this.onRetry});

  final String error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, color: AppColors.danger, size: 40),
            const SizedBox(height: 12),
            Text(
              error.isEmpty ? 'Could not load profile' : error,
              textAlign: TextAlign.center,
              style: AppTypography.body,
            ),
            const SizedBox(height: 16),
            AppButton(label: 'Retry', onPressed: onRetry),
          ],
        ),
      ),
    );
  }
}

String _initials(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
  return parts.map((p) => p[0]).join().toUpperCase().padRight(2, 'A').substring(0, 2);
}

String _date(DateTime? value) {
  if (value == null) return 'N/A';
  return DateFormat('dd MMM yyyy').format(value);
}

String _currency(num value) {
  return NumberFormat.currency(
    locale: 'en_IN',
    symbol: 'INR ',
    decimalDigits: 0,
  ).format(value);
}
