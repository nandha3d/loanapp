import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:zolofund/core/theme/app_colors.dart';
import 'package:zolofund/core/theme/app_tokens.dart';
import 'package:zolofund/core/theme/app_typography.dart';
import 'package:zolofund/data/models/superadmin_profile.dart' show ProfileAccount;
import 'package:zolofund/data/services/account_service.dart';
import 'package:zolofund/shared/widgets/app_button.dart';

/// Self-service account profile for non-superadmin roles (admin, agent,
/// developer) — name/phone edit + OTP password change. Superadmin has its
/// own richer screen (SuperadminProfileScreen); this is the generic one.
class AccountProfileScreen extends ConsumerStatefulWidget {
  const AccountProfileScreen({super.key});

  @override
  ConsumerState<AccountProfileScreen> createState() =>
      _AccountProfileScreenState();
}

class _AccountProfileScreenState extends ConsumerState<AccountProfileScreen> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  final _passwordController = TextEditingController();
  final _nameFocus = FocusNode();

  ProfileAccount? _account;
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
    _nameFocus.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final account = await ref.read(accountServiceProvider).getAccount();
      _nameController.text = account.name;
      _phoneController.text = account.phone;
      setState(() {
        _account = account;
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
      final account = await ref.read(accountServiceProvider).updateAccount(
            name: _nameController.text.trim(),
            phone: _phoneController.text.trim(),
          );
      setState(() {
        _account = account;
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
      await ref.read(accountServiceProvider).sendPasswordOtp();
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
      await ref.read(accountServiceProvider).changePassword(
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
    final account = _account;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('My Profile'),
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
            : account == null
                ? _ErrorView(error: _error, onRetry: _load)
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        _HeroCard(
                          account: account,
                          onEditName: () => _nameFocus.requestFocus(),
                        ),
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
                          account: account,
                          nameController: _nameController,
                          phoneController: _phoneController,
                          nameFocus: _nameFocus,
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
                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
      ),
    );
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.account, required this.onEditName});

  final ProfileAccount account;
  final VoidCallback onEditName;

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
              _initials(account.name),
              style: AppTypography.nameLg.copyWith(color: Colors.white),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        account.name,
                        style: AppTypography.sectionTitle.copyWith(
                          color: Colors.white,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.edit_outlined,
                          color: Colors.white70, size: 18,),
                      tooltip: 'Edit name',
                      onPressed: onEditName,
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(
                          minWidth: 32, minHeight: 32,),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  account.email ?? 'No email on file',
                  style: AppTypography.caption.copyWith(
                    color: Colors.white70,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 8),
                _StatusChip(
                  label: account.role.toUpperCase(),
                  color: AppColors.primary,
                  textColor: Colors.white,
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
    required this.account,
    required this.nameController,
    required this.phoneController,
    required this.nameFocus,
    required this.saving,
    required this.onSave,
  });

  final ProfileAccount account;
  final TextEditingController nameController;
  final TextEditingController phoneController;
  final FocusNode nameFocus;
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
            focusNode: nameFocus,
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
              _InfoItem(label: 'Username', value: account.username),
              _InfoItem(label: 'Status', value: account.status),
              _InfoItem(
                  label: 'Branch', value: account.branchName ?? 'All branches',),
              _InfoItem(label: 'Last login', value: _date(account.lastLoginAt)),
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
  });

  final String label;
  final Color color;
  final Color textColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(AppTokens.radiusBadge),
      ),
      child: Text(
        label,
        style: AppTypography.tiny.copyWith(
          color: textColor,
          fontWeight: FontWeight.w700,
        ),
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
