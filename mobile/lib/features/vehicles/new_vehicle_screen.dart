import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/core/theme/app_tokens.dart';
import 'package:loantrack/core/theme/app_typography.dart';
import 'package:loantrack/data/repositories/customer_repository.dart';
import 'package:loantrack/data/services/vehicles_service.dart';

/// Create a vehicle for a customer. Mirrors the web "New Vehicle" form; all
/// persistence goes through POST /api/v1/vehicles.
class NewVehicleScreen extends ConsumerStatefulWidget {
  const NewVehicleScreen({super.key});

  @override
  ConsumerState<NewVehicleScreen> createState() => _NewVehicleScreenState();
}

class _NewVehicleScreenState extends ConsumerState<NewVehicleScreen> {
  final _reg = TextEditingController();
  final _make = TextEditingController();
  final _model = TextEditingController();
  final _year = TextEditingController();
  final _color = TextEditingController();
  final _engine = TextEditingController();
  final _chassis = TextEditingController();
  String? _customerId;
  String _vehicleType = 'two_wheeler';
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _reg.dispose();
    _make.dispose();
    _model.dispose();
    _year.dispose();
    _color.dispose();
    _engine.dispose();
    _chassis.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final t = T.of(ref);
    if (_customerId == null) {
      setState(() => _error = t.x('veh.customer_required'));
      return;
    }
    if (_reg.text.trim().isEmpty || _make.text.trim().isEmpty || _model.text.trim().isEmpty) {
      setState(() => _error = t.x('veh.fields_required'));
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(vehiclesServiceProvider).create({
        'customerId': _customerId,
        'registrationNo': _reg.text.trim(),
        'make': _make.text.trim(),
        'model': _model.text.trim(),
        if (_year.text.trim().isNotEmpty) 'year': int.tryParse(_year.text.trim()),
        if (_color.text.trim().isNotEmpty) 'color': _color.text.trim(),
        if (_engine.text.trim().isNotEmpty) 'engineNo': _engine.text.trim(),
        if (_chassis.text.trim().isNotEmpty) 'chassisNo': _chassis.text.trim(),
        'vehicleType': _vehicleType,
      });
      if (!mounted) return;
      context.pop(true);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t.x('veh.created')), backgroundColor: AppColors.success),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  InputDecoration _dec(String label, {bool required = false}) => InputDecoration(
        labelText: required ? '$label *' : label,
        isDense: true,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppTokens.radiusSm)),
      );

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final customers = ref.watch(customerListProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(t.x('veh.new_title')),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.canPop() ? context.pop() : context.go('/vehicles'),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          customers.when(
            loading: () => const LinearProgressIndicator(),
            error: (e, _) => Text(t.x('err.failed_to_load'),
                style: AppTypography.caption.copyWith(color: AppColors.danger),),
            data: (list) => DropdownButtonFormField<String>(
              initialValue: _customerId,
              isExpanded: true,
              decoration: _dec(t.x('veh.customer'), required: true),
              items: list
                  .map((c) => DropdownMenuItem(
                        value: c.id,
                        child: Text('${c.name} (${c.customerCode})',
                            overflow: TextOverflow.ellipsis,),
                      ),)
                  .toList(),
              onChanged: (v) => setState(() => _customerId = v),
            ),
          ),
          const SizedBox(height: 12),
          TextField(controller: _reg, textCapitalization: TextCapitalization.characters, decoration: _dec(t.x('veh.registration'), required: true)),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: TextField(controller: _make, decoration: _dec(t.x('veh.make'), required: true))),
            const SizedBox(width: 12),
            Expanded(child: TextField(controller: _model, decoration: _dec(t.x('veh.model'), required: true))),
          ],),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: TextField(controller: _year, keyboardType: TextInputType.number, decoration: _dec(t.x('veh.year')))),
            const SizedBox(width: 12),
            Expanded(child: TextField(controller: _color, decoration: _dec(t.x('veh.color')))),
          ],),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _vehicleType,
            decoration: _dec(t.x('veh.type')),
            items: const [
              DropdownMenuItem(value: 'two_wheeler', child: Text('Two Wheeler')),
              DropdownMenuItem(value: 'four_wheeler', child: Text('Four Wheeler')),
              DropdownMenuItem(value: 'commercial', child: Text('Commercial')),
            ],
            onChanged: (v) => setState(() => _vehicleType = v ?? 'two_wheeler'),
          ),
          const SizedBox(height: 12),
          TextField(controller: _engine, decoration: _dec(t.x('veh.engine'))),
          const SizedBox(height: 12),
          TextField(controller: _chassis, decoration: _dec(t.x('veh.chassis'))),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: AppTypography.caption.copyWith(color: AppColors.danger)),
          ],
          const SizedBox(height: 20),
          SizedBox(
            height: 50,
            child: FilledButton(
              style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
              onPressed: _submitting ? null : _submit,
              child: _submitting
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : Text(t.x('veh.create_btn')),
            ),
          ),
        ],
      ),
    );
  }
}
