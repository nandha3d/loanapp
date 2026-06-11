import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:loantrack/core/auth/auth_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/models/pricing.dart';
import 'package:loantrack/data/services/pricing_service.dart';
import 'package:loantrack/shared/widgets/app_button.dart';
import 'package:loantrack/shared/widgets/app_text_field.dart';

class RegistrationScreen extends ConsumerStatefulWidget {
  const RegistrationScreen({
    super.key,
    this.googleEmail,
    this.googleName,
    this.googleId,
    this.googleIdToken,
    this.referralCode,
  });

  final String? googleEmail;
  final String? googleName;
  final String? googleId;
  // The Google idToken (JWT) the backend re-verifies to complete registration.
  final String? googleIdToken;
  final String? referralCode;

  @override
  ConsumerState<RegistrationScreen> createState() => _RegistrationScreenState();
}

class _RegistrationScreenState extends ConsumerState<RegistrationScreen> {
  int _step = 1;
  bool _loading = false;
  bool _catalogLoading = true;
  String? _catalogError;

  // Catalog data
  List<PlanCatalogItem> _plans = [];
  List<ModuleCatalogItem> _modules = [];
  List<AddonCatalogItem> _addons = [];

  // Form Fields
  final _businessNameCtrl = TextEditingController();
  final _ownerNameCtrl = TextEditingController();
  final _ownerPhoneCtrl = TextEditingController();
  final _ownerUsernameCtrl = TextEditingController();
  final _ownerPasswordCtrl = TextEditingController();
  final _referralCtrl = TextEditingController();

  String _selectedPlan = 'basic';
  final List<String> _selectedModules = ['microlending'];
  final List<String> _selectedAddons = [];
  bool _termsAccepted = false;

  @override
  void initState() {
    super.initState();
    _ownerNameCtrl.text = widget.googleName ?? '';
    _referralCtrl.text = widget.referralCode ?? '';
    if (widget.googleEmail != null) {
      final emailPrefix = widget.googleEmail!.split('@')[0];
      _ownerUsernameCtrl.text = emailPrefix.replaceAll(RegExp(r'[^a-zA-Z0-9]'), '').toLowerCase();
    }
    _loadCatalog();
  }

  @override
  void dispose() {
    _businessNameCtrl.dispose();
    _ownerNameCtrl.dispose();
    _ownerPhoneCtrl.dispose();
    _ownerUsernameCtrl.dispose();
    _ownerPasswordCtrl.dispose();
    _referralCtrl.dispose();
    super.dispose();
  }

  bool get _isGoogleRegister =>
      widget.googleIdToken != null || widget.googleId != null;

  Future<void> _loadCatalog() async {
    try {
      final catalog = await ref.read(pricingServiceProvider).fetchPricingCatalog();
      setState(() {
        _plans = catalog.plans;
        _modules = catalog.modules;
        _addons = catalog.addons;
        if (_plans.isNotEmpty) {
          _selectedPlan = _plans.first.plan;
        }
        _catalogLoading = false;
      });
    } catch (e) {
      setState(() {
        _catalogError = e.toString();
        _catalogLoading = false;
      });
    }
  }

  int _calculateTotal() {
    int total = 0;
    final plan = _plans.firstWhere((p) => p.plan == _selectedPlan, orElse: () => _plans.first);
    total += plan.monthlyPrice;

    for (final m in _modules) {
      if (_selectedModules.contains(m.module)) {
        total += m.monthlyPrice;
      }
    }
    for (final a in _addons) {
      if (_selectedAddons.contains(a.addon)) {
        total += a.monthlyPrice;
      }
    }
    return total;
  }

  void _nextStep() {
    if (_step == 1) {
      if (_businessNameCtrl.text.isEmpty ||
          _ownerNameCtrl.text.isEmpty ||
          _ownerPhoneCtrl.text.isEmpty ||
          _ownerUsernameCtrl.text.isEmpty ||
          (!_isGoogleRegister && _ownerPasswordCtrl.text.isEmpty)) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please fill in all owner and business details.')),
        );
        return;
      }
    }
    setState(() {
      _step++;
    });
  }

  void _prevStep() {
    setState(() {
      _step--;
    });
  }

  Future<void> _submit() async {
    if (!_termsAccepted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You must accept the terms and conditions.')),
      );
      return;
    }

    setState(() {
      _loading = true;
    });

    try {
      if (_isGoogleRegister) {
        await ref.read(authControllerProvider.notifier).registerWithGoogle(
              idToken: widget.googleIdToken ?? widget.googleId!,
              businessName: _businessNameCtrl.text,
              ownerPhone: _ownerPhoneCtrl.text,
              selectedPlan: _selectedPlan,
              selectedModules: _selectedModules,
              selectedAddons: _selectedAddons,
              referralCode: _referralCtrl.text.trim(),
            );
      } else {
        await ref.read(authControllerProvider.notifier).registerWithEmail(
              businessName: _businessNameCtrl.text,
              ownerName: _ownerNameCtrl.text,
              ownerPhone: _ownerPhoneCtrl.text,
              ownerUsername: _ownerUsernameCtrl.text,
              ownerPassword: _ownerPasswordCtrl.text,
              selectedPlan: _selectedPlan,
              selectedModules: _selectedModules,
              selectedAddons: _selectedAddons,
              referralCode: _referralCtrl.text.trim(),
            );
      }

      // Check if registration was successful by seeing if auth controller logged them in
      final authState = ref.read(authControllerProvider);
      if (authState.stage == AuthStage.authenticated) {
        if (mounted) {
          context.go('/dashboard');
        }
      } else if (authState.error != null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(authState.error!)),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_catalogLoading) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    if (_catalogError != null) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, size: 64, color: AppColors.danger),
                const SizedBox(height: 16),
                Text(
                  'Failed to load pricing info',
                  style: AppTypography.sectionTitle,
                ),
                const SizedBox(height: 8),
                Text(_catalogError!, textAlign: TextAlign.center),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () {
                    setState(() {
                      _catalogLoading = true;
                      _catalogError = null;
                    });
                    _loadCatalog();
                  },
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Register Business'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            stops: [0.0, 0.5, 1.0],
            colors: [
              Color(0xFF1A1D23),
              Color(0xFF2D1F0E),
              Color(0xFF1A1D23),
            ],
          ),
        ),
        child: Column(
          children: [
            _buildStepper(),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20.0),
                child: _buildStepContent(),
              ),
            ),
            _buildNavigationButtons(),
          ],
        ),
      ),
    );
  }

  Widget _buildStepper() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
      color: Colors.black26,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: List.generate(5, (index) {
          final stepNum = index + 1;
          final isActive = _step >= stepNum;
          final isCurrent = _step == stepNum;
          return Row(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isActive ? AppColors.primary : Colors.grey[800],
                  border: isCurrent ? Border.all(color: Colors.white, width: 2) : null,
                ),
                child: Center(
                  child: Text(
                    '$stepNum',
                    style: TextStyle(
                      color: isActive ? Colors.white : Colors.grey[400],
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ),
              ),
              if (index < 4)
                Container(
                  width: MediaQuery.of(context).size.width / 8,
                  height: 2,
                  color: _step > stepNum ? AppColors.primary : Colors.grey[800],
                ),
            ],
          );
        }),
      ),
    );
  }

  Widget _buildStepContent() {
    switch (_step) {
      case 1:
        return _buildStep1();
      case 2:
        return _buildStep2();
      case 3:
        return _buildStep3();
      case 4:
        return _buildStep4();
      case 5:
        return _buildStep5();
      default:
        return const SizedBox();
    }
  }

  Widget _buildStep1() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: AppTokens.shadowLg,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Business Profile', style: AppTypography.sectionTitle),
          const SizedBox(height: 8),
          const Text('Enter owner credentials and lending business details.', style: TextStyle(color: AppColors.textSecondary)),
          const SizedBox(height: 24),
          if (_isGoogleRegister) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.green.withValues(alpha: 0.1),
                border: Border.all(color: Colors.green),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.check_circle, color: Colors.green),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Google Email Verified: ${widget.googleEmail}',
                      style: const TextStyle(color: Colors.green, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],
          AppTextField(
            label: 'Business Name',
            controller: _businessNameCtrl,
            prefixIcon: Icons.business,
          ),
          const SizedBox(height: 16),
          AppTextField(
            label: 'Owner Full Name',
            controller: _ownerNameCtrl,
            prefixIcon: Icons.person_outline,
          ),
          const SizedBox(height: 16),
          AppTextField(
            label: 'Owner Mobile Phone',
            controller: _ownerPhoneCtrl,
            prefixIcon: Icons.phone_android,
            keyboardType: TextInputType.phone,
          ),
          const SizedBox(height: 16),
          AppTextField(
            label: 'Login Username',
            controller: _ownerUsernameCtrl,
            prefixIcon: Icons.alternate_email,
          ),
          if (!_isGoogleRegister) ...[
            const SizedBox(height: 16),
            AppTextField(
              label: 'Login Password',
              controller: _ownerPasswordCtrl,
              prefixIcon: Icons.lock_outline,
              obscureText: true,
            ),
          ],
          const SizedBox(height: 16),
          AppTextField(
            label: 'Referral Code (optional)',
            controller: _referralCtrl,
            prefixIcon: Icons.card_giftcard,
          ),
        ],
      ),
    );
  }

  Widget _buildStep2() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: AppTokens.shadowLg,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Select Modules', style: AppTypography.sectionTitle),
          const SizedBox(height: 8),
          const Text('Enable modular lending configurations inside your workspace.', style: TextStyle(color: AppColors.textSecondary)),
          const SizedBox(height: 24),
          ..._modules.map((m) {
            final isSelected = _selectedModules.contains(m.module);
            final isDefault = m.module == 'microlending';
            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                border: Border.all(
                  color: isSelected ? AppColors.primary : Colors.grey[800]!,
                  width: 2,
                ),
                borderRadius: BorderRadius.circular(12),
                color: isSelected ? Colors.amber.withValues(alpha: 0.05) : null,
              ),
              child: CheckboxListTile(
                value: isSelected,
                title: Text(m.displayName, style: const TextStyle(fontWeight: FontWeight.bold)),
                subtitle: Text(m.description ?? '', style: const TextStyle(fontSize: 11)),
                secondary: Icon(
                  m.module == 'microlending'
                      ? Icons.monetization_on
                      : m.module == 'autofinance'
                          ? Icons.directions_car
                          : Icons.savings,
                  color: isSelected ? AppColors.primary : Colors.grey,
                ),
                onChanged: isDefault
                    ? null
                    : (val) {
                        setState(() {
                          if (val == true) {
                            _selectedModules.add(m.module);
                          } else {
                            _selectedModules.remove(m.module);
                          }
                        });
                      },
                activeColor: AppColors.primary,
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildStep3() {
    return Column(
      children: _plans.map((p) {
        final isSelected = _selectedPlan == p.plan;
        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isSelected ? AppColors.primary : Colors.transparent,
              width: 2,
            ),
            boxShadow: AppTokens.shadowLg,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    p.displayName,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: isSelected ? AppColors.primary : Colors.grey[850],
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '₹${p.monthlyPrice}/mo',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                p.description ?? '',
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
              ),
              const Divider(height: 24, color: Colors.white10),
              Column(
                children: p.features.map((f) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4.0),
                    child: Row(
                      children: [
                        const Icon(Icons.check, size: 16, color: Colors.green),
                        const SizedBox(width: 8),
                        Expanded(child: Text(f, style: const TextStyle(fontSize: 12))),
                      ],
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 20),
              AppButton(
                label: isSelected ? 'Selected' : 'Select Plan',
                onPressed: () {
                  setState(() {
                    _selectedPlan = p.plan;
                  });
                },
                expand: true,
                variant: isSelected ? AppButtonVariant.primary : AppButtonVariant.secondary,
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildStep4() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: AppTokens.shadowLg,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Select Add-on Features', style: AppTypography.sectionTitle),
          const SizedBox(height: 8),
          const Text('Enable additional billing integrations inside your workspace.', style: TextStyle(color: AppColors.textSecondary)),
          const SizedBox(height: 24),
          ..._addons.map((a) {
            final isSelected = _selectedAddons.contains(a.addon);
            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                border: Border.all(
                  color: isSelected ? AppColors.primary : Colors.grey[800]!,
                  width: 2,
                ),
                borderRadius: BorderRadius.circular(12),
                color: isSelected ? Colors.amber.withValues(alpha: 0.05) : null,
              ),
              child: SwitchListTile(
                value: isSelected,
                title: Text(a.displayName, style: const TextStyle(fontWeight: FontWeight.bold)),
                subtitle: Text('${a.description ?? ''} (+₹${a.monthlyPrice}/mo)', style: const TextStyle(fontSize: 11)),
                secondary: Icon(
                  a.addon == 'whatsapp_sms'
                      ? Icons.sms
                      : a.addon == 'kyc'
                          ? Icons.assignment_ind
                          : a.addon == 'gps_tracking'
                              ? Icons.my_location
                              : a.addon == 'premium_accounting'
                                  ? Icons.receipt_long
                                  : Icons.account_balance,
                  color: isSelected ? AppColors.primary : Colors.grey,
                ),
                onChanged: (val) {
                  setState(() {
                    if (val == true) {
                      _selectedAddons.add(a.addon);
                    } else {
                      _selectedAddons.remove(a.addon);
                    }
                  });
                },
                activeThumbColor: AppColors.primary,
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildStep5() {
    final total = _calculateTotal();
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: AppTokens.shadowLg,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Review Details', style: AppTypography.sectionTitle),
          const SizedBox(height: 16),
          _buildReviewRow('Business Name', _businessNameCtrl.text),
          _buildReviewRow('Owner Name', _ownerNameCtrl.text),
          _buildReviewRow('Owner Phone', _ownerPhoneCtrl.text),
          _buildReviewRow('Login Username', _ownerUsernameCtrl.text),
          _buildReviewRow('Plan Selected', _selectedPlan.toUpperCase()),
          _buildReviewRow('Modules Enabled', _selectedModules.join(', ')),
          _buildReviewRow('Addons Enabled', _selectedAddons.isEmpty ? 'None' : _selectedAddons.join(', ')),
          const Divider(height: 32, color: Colors.white10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Estimated Monthly Total', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              Text('₹$total/mo', style: TextStyle(fontSize: 18, color: AppColors.primary, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 24),
          CheckboxListTile(
            value: _termsAccepted,
            title: const Text('I accept the terms and conditions', style: TextStyle(fontSize: 12)),
            onChanged: (val) {
              setState(() {
                _termsAccepted = val ?? false;
              });
            },
            activeColor: AppColors.primary,
            controlAffinity: ListTileControlAffinity.leading,
            contentPadding: EdgeInsets.zero,
          ),
        ],
      ),
    );
  }

  Widget _buildReviewRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
          ),
          Expanded(
            child: Text(value, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _buildNavigationButtons() {
    return Container(
      padding: const EdgeInsets.all(20),
      color: Colors.black26,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          if (_step > 1)
            AppButton(
              label: 'Back',
              onPressed: _loading ? null : _prevStep,
              variant: AppButtonVariant.ghost,
            )
          else
            AppButton(
              label: 'Cancel',
              onPressed: _loading ? null : () => context.pop(),
              variant: AppButtonVariant.ghost,
            ),
          if (_step < 5)
            AppButton(
              label: 'Continue',
              onPressed: _nextStep,
            )
          else
            AppButton(
              label: 'Register',
              loading: _loading,
              onPressed: _submit,
            ),
        ],
      ),
    );
  }
}
