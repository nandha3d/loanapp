import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:zolofund/core/auth/auth_controller.dart';
import 'package:zolofund/core/currency/currency_controller.dart';
import 'package:zolofund/core/l10n/language_controller.dart';
import 'package:zolofund/data/models/user.dart';
import 'package:zolofund/data/services/accounting_service.dart';

double _amount(dynamic value) => double.tryParse('$value') ?? 0;

class VendorBillsView extends ConsumerStatefulWidget {
  const VendorBillsView({super.key});

  @override
  ConsumerState<VendorBillsView> createState() => _VendorBillsViewState();
}

class _VendorBillsViewState extends ConsumerState<VendorBillsView> {
  int _page = 1;
  Map<String, dynamic>? _data;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final data =
          await ref.read(accountingServiceProvider).listVendorPage(_page);
      if (mounted) setState(() => _data = data);
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openAgeing() async {
    final t = T.of(ref);
    final fmt = ref.read(currencyFmtProvider);
    try {
      final rows = await ref.read(accountingServiceProvider).getVendorAgeing();
      if (!mounted) return;
      await showDialog<void>(
          context: context,
          builder: (dialogContext) => AlertDialog(
                title: Text(t.x('accounting.vendor_ageing')),
                content: SizedBox(
                    width: double.maxFinite,
                    child: ListView(
                      shrinkWrap: true,
                      children: rows
                          .map((row) => ListTile(
                                title: Text('${row['name']}'),
                                subtitle: Text(
                                    '${t.x('accounting.age_0_30')}: ${fmt.format(_amount(row['b0']))}\n'
                                    '${t.x('accounting.age_31_60')}: ${fmt.format(_amount(row['b30']))}\n'
                                    '${t.x('accounting.age_61_90')}: ${fmt.format(_amount(row['b60']))}\n'
                                    '${t.x('accounting.age_90_plus')}: ${fmt.format(_amount(row['b90']))}'),
                                trailing:
                                    Text(fmt.format(_amount(row['total']))),
                              ),)
                          .toList(),
                    ),),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(dialogContext),
                      child: Text(t.x('common.close')),),
                ],
              ),);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$error')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);
    final role = ref.watch(authControllerProvider).user?.role;
    final canWrite = role == UserRole.admin ||
        role == UserRole.superadmin ||
        role == UserRole.developer;
    final rows = (_data?['rows'] as List<dynamic>? ?? [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
    final pages = (_data?['pages'] as num?)?.toInt() ?? 1;
    return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Wrap(spacing: 8, children: [
              if (canWrite)
                FilledButton.icon(
                  onPressed: _busy
                      ? null
                      : () async {
                          final changed = await Navigator.push<bool>(
                              context,
                              MaterialPageRoute(
                                builder: (_) => const VendorFormScreen(),
                              ),);
                          if (changed == true) {
                            _page = 1;
                            await _load();
                          }
                        },
                  icon: const Icon(Icons.add),
                  label: Text(t.x('accounting.create_vendor')),
                ),
              OutlinedButton.icon(
                  onPressed: _openAgeing,
                  icon: const Icon(Icons.schedule),
                  label: Text(t.x('accounting.vendor_ageing')),),
            ],),
            if (_busy && _data == null)
              const Center(child: CircularProgressIndicator()),
            if (_error != null)
              ListTile(
                  title: Text('${t.x('common.error')}: $_error'),
                  trailing: IconButton(
                      icon: const Icon(Icons.refresh), onPressed: _load,),),
            if (!_busy && rows.isEmpty && _error == null)
              ListTile(title: Text(t.x('accounting.no_vendors'))),
            for (final row in rows)
              Card(
                  child: ListTile(
                title: Text('${row['name']}'),
                subtitle: Text(
                    '${row['openBillCount'] ?? 0} ${t.x('accounting.open_bills')} · '
                    '${fmt.format(_amount(row['outstanding']))}'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () async {
                  await Navigator.push<void>(
                      context,
                      MaterialPageRoute(
                        builder: (_) => VendorDetailScreen(id: '${row['id']}'),
                      ),);
                  await _load();
                },
              ),),
            if (pages > 1)
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                IconButton(
                    tooltip: t.x('pen.previous_page'),
                    onPressed: _busy || _page <= 1
                        ? null
                        : () {
                            _page--;
                            _load();
                          },
                    icon: const Icon(Icons.chevron_left),),
                Text('$_page / $pages'),
                IconButton(
                    tooltip: t.x('pen.next_page'),
                    onPressed: _busy || _page >= pages
                        ? null
                        : () {
                            _page++;
                            _load();
                          },
                    icon: const Icon(Icons.chevron_right),),
              ],),
          ],
        ),);
  }
}

class VendorFormScreen extends ConsumerStatefulWidget {
  const VendorFormScreen({this.vendor, super.key});
  final Map<String, dynamic>? vendor;

  @override
  ConsumerState<VendorFormScreen> createState() => _VendorFormScreenState();
}

class _VendorFormScreenState extends ConsumerState<VendorFormScreen> {
  final _form = GlobalKey<FormState>();
  final _fields = <String, TextEditingController>{};
  bool _busy = false;
  static const _names = [
    'name',
    'gstin',
    'pan',
    'email',
    'phone',
    'address',
    'tdsSection',
    'tdsRate',
    'bankName',
    'bankAccountNo',
    'bankIfsc',
  ];

  @override
  void initState() {
    super.initState();
    for (final name in _names) {
      _fields[name] =
          TextEditingController(text: '${widget.vendor?[name] ?? ''}');
    }
  }

  @override
  void dispose() {
    for (final field in _fields.values) {
      field.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    final t = T.of(ref);
    final rate = _fields['tdsRate']!.text.trim();
    final values = <String, dynamic>{};
    for (final name in _names) {
      if (name != 'tdsRate') values[name] = _fields[name]!.text.trim();
    }
    if (rate.isNotEmpty) values['tdsRate'] = double.parse(rate);
    setState(() => _busy = true);
    try {
      await ref
          .read(accountingServiceProvider)
          .saveVendor(values, id: widget.vendor?['id']?.toString());
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('${t.x('common.error')}: $error')),);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    return Scaffold(
      appBar: AppBar(
          title: Text(t.x(widget.vendor == null
              ? 'accounting.create_vendor'
              : 'accounting.edit_vendor',),),),
      body: Form(
          key: _form,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            for (final name in _names)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: TextFormField(
                  controller: _fields[name],
                  decoration: InputDecoration(
                      labelText: t.x('accounting.vendor_$name'),),
                  keyboardType: name == 'tdsRate'
                      ? const TextInputType.numberWithOptions(decimal: true)
                      : name == 'email'
                          ? TextInputType.emailAddress
                          : TextInputType.text,
                  validator: (value) {
                    if (name == 'name' &&
                        (value == null || value.trim().isEmpty)) {
                      return t.x('accounting.vendor_required');
                    }
                    if (name == 'tdsRate' &&
                        value != null &&
                        value.trim().isNotEmpty) {
                      final rate = double.tryParse(value);
                      if (rate == null || rate < 0 || rate > 1) {
                        return t.x('accounting.invalid_tds_rate');
                      }
                    }
                    return null;
                  },
                ),
              ),
            FilledButton(
                onPressed: _busy ? null : _save,
                child: Text(t.x('common.save')),),
          ],),),
    );
  }
}

class VendorDetailScreen extends ConsumerStatefulWidget {
  const VendorDetailScreen({required this.id, super.key});
  final String id;

  @override
  ConsumerState<VendorDetailScreen> createState() => _VendorDetailScreenState();
}

class _VendorDetailScreenState extends ConsumerState<VendorDetailScreen> {
  Map<String, dynamic>? _vendor;
  Map<String, dynamic>? _bills;
  int _page = 1;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final service = ref.read(accountingServiceProvider);
      final vendor = await service.getVendor(widget.id);
      final bills = await service.listVendorBills(widget.id, _page);
      if (mounted) {
        setState(() {
          _vendor = vendor;
          _bills = bills;
        });
      }
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _deactivate() async {
    final t = T.of(ref);
    final yes = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
              title: Text(t.x('accounting.deactivate_vendor')),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(dialogContext, false),
                    child: Text(t.x('common.cancel')),),
                FilledButton(
                    onPressed: () => Navigator.pop(dialogContext, true),
                    child: Text(t.x('accounting.deactivate_vendor')),),
              ],
            ),);
    if (yes != true) return;
    try {
      await ref.read(accountingServiceProvider).deactivateVendor(widget.id);
      if (mounted) Navigator.pop(context);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$error')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);
    final role = ref.watch(authControllerProvider).user?.role;
    final canWrite = role == UserRole.admin ||
        role == UserRole.superadmin ||
        role == UserRole.developer;
    final canDeactivate =
        role == UserRole.superadmin || role == UserRole.developer;
    final rows = (_bills?['rows'] as List<dynamic>? ?? [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
    final pages = (_bills?['pages'] as num?)?.toInt() ?? 1;
    return Scaffold(
      appBar: AppBar(
          title: Text('${_vendor?['name'] ?? t.x('accounting.vendors')}'),),
      body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            if (_busy && _vendor == null)
              const Center(child: CircularProgressIndicator()),
            if (_error != null)
              ListTile(
                  title: Text('${t.x('common.error')}: $_error'),
                  trailing: IconButton(
                      icon: const Icon(Icons.refresh), onPressed: _load,),),
            if (_vendor != null) ...[
              Text('${_vendor!['gstin'] ?? ''} · ${_vendor!['pan'] ?? ''}'),
              Text('${_vendor!['phone'] ?? ''} · ${_vendor!['email'] ?? ''}'),
              Wrap(spacing: 8, children: [
                if (canWrite)
                  OutlinedButton.icon(
                      onPressed: () async {
                        final changed = await Navigator.push<bool>(
                            context,
                            MaterialPageRoute(
                              builder: (_) => VendorFormScreen(vendor: _vendor),
                            ),);
                        if (changed == true) await _load();
                      },
                      icon: const Icon(Icons.edit),
                      label: Text(t.x('accounting.edit_vendor')),),
                if (canDeactivate && _vendor!['isActive'] == true)
                  TextButton(
                      onPressed: _deactivate,
                      child: Text(t.x('accounting.deactivate_vendor')),),
                if (canWrite && _vendor!['isActive'] == true)
                  FilledButton.icon(
                      onPressed: () async {
                        final changed = await Navigator.push<bool>(
                            context,
                            MaterialPageRoute(
                              builder: (_) =>
                                  BillFormScreen(vendorId: widget.id),
                            ),);
                        if (changed == true) {
                          _page = 1;
                          await _load();
                        }
                      },
                      icon: const Icon(Icons.add),
                      label: Text(t.x('accounting.create_bill')),),
              ],),
              const Divider(),
              Text(t.x('accounting.bills'),
                  style: Theme.of(context).textTheme.titleMedium,),
              for (final bill in rows)
                Card(
                    child: ListTile(
                  title: Text('${bill['billNo']}'),
                  subtitle: Text(
                      '${bill['status']} · ${DateTime.tryParse('${bill['dueDate']}')?.toLocal().toString().split(' ').first ?? ''}',),
                  trailing: Text(fmt.format(_amount(bill['totalAmount']) -
                      _amount(bill['paidAmount']),),),
                  onTap: () async {
                    await Navigator.push<void>(
                        context,
                        MaterialPageRoute(
                          builder: (_) => BillDetailScreen(id: '${bill['id']}'),
                        ),);
                    await _load();
                  },
                ),),
              if (pages > 1)
                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  IconButton(
                      tooltip: t.x('pen.previous_page'),
                      onPressed: _busy || _page <= 1
                          ? null
                          : () {
                              _page--;
                              _load();
                            },
                      icon: const Icon(Icons.chevron_left),),
                  Text('$_page / $pages'),
                  IconButton(
                      tooltip: t.x('pen.next_page'),
                      onPressed: _busy || _page >= pages
                          ? null
                          : () {
                              _page++;
                              _load();
                            },
                      icon: const Icon(Icons.chevron_right),),
                ],),
            ],
          ],),),
    );
  }
}

class _BillLine {
  String? accountId;
  final amount = TextEditingController();
  final gstRate = TextEditingController(text: '0');
  final description = TextEditingController();
  void dispose() {
    amount.dispose();
    gstRate.dispose();
    description.dispose();
  }
}

class BillFormScreen extends ConsumerStatefulWidget {
  const BillFormScreen({required this.vendorId, super.key});
  final String vendorId;
  @override
  ConsumerState<BillFormScreen> createState() => _BillFormScreenState();
}

class _BillFormScreenState extends ConsumerState<BillFormScreen> {
  final _billNo = TextEditingController();
  final _description = TextEditingController();
  final _lines = <_BillLine>[_BillLine()];
  late final Future<List<Map<String, dynamic>>> _accounts;
  DateTime _billDate = DateTime.now();
  DateTime _dueDate = DateTime.now();
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _accounts = ref.read(accountingServiceProvider).listCoA();
  }

  @override
  void dispose() {
    _billNo.dispose();
    _description.dispose();
    for (final line in _lines) {
      line.dispose();
    }
    super.dispose();
  }

  Future<void> _pickDate(bool due) async {
    final initial = due ? _dueDate : _billDate;
    final date = await showDatePicker(
        context: context,
        initialDate: initial,
        firstDate: DateTime(2000),
        lastDate: DateTime(2100),);
    if (date != null) {
      setState(() {
        if (due) {
          _dueDate = date;
        } else {
          _billDate = date;
        }
      });
    }
  }

  Future<void> _save() async {
    final t = T.of(ref);
    final money = RegExp(r'^\d+(\.\d{1,2})?$');
    final lines = <Map<String, dynamic>>[];
    for (final line in _lines) {
      final amount = line.amount.text.trim();
      final rate = double.tryParse(line.gstRate.text.trim());
      if (line.accountId == null ||
          !money.hasMatch(amount) ||
          double.parse(amount) <= 0 ||
          rate == null ||
          rate < 0 ||
          rate > 100) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(t.x('accounting.invalid_bill_line'))),);
        return;
      }
      lines.add({
        'accountId': line.accountId,
        'amount': double.parse(amount),
        'gstRate': rate,
        'description': line.description.text.trim(),
      });
    }
    if (_billNo.text.trim().isEmpty || _dueDate.isBefore(_billDate)) {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(t.x('accounting.invalid_bill'))),);
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(accountingServiceProvider).createBill(widget.vendorId, {
        'billNo': _billNo.text.trim(),
        'billDate': DateFormat('yyyy-MM-dd').format(_billDate),
        'dueDate': DateFormat('yyyy-MM-dd').format(_dueDate),
        'description': _description.text.trim(),
        'lines': lines,
      });
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$error')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    return Scaffold(
      appBar: AppBar(title: Text(t.x('accounting.create_bill'))),
      body: FutureBuilder<List<Map<String, dynamic>>>(
          future: _accounts,
          builder: (context, snapshot) {
            if (snapshot.hasError) {
              return Center(child: Text('${snapshot.error}'));
            }
            if (!snapshot.hasData) {
              return const Center(child: CircularProgressIndicator());
            }
            final accounts = snapshot.data!
                .where((row) =>
                    row['classType'] == 'expense' && row['isActive'] == true,)
                .toList();
            return ListView(padding: const EdgeInsets.all(16), children: [
              TextField(
                  controller: _billNo,
                  decoration: InputDecoration(
                      labelText: t.x('accounting.bill_number'),),),
              TextField(
                  controller: _description,
                  decoration: InputDecoration(
                      labelText: t.x('accounting.description'),),),
              ListTile(
                  title: Text(t.x('accounting.bill_date')),
                  subtitle: Text(DateFormat('yyyy-MM-dd').format(_billDate)),
                  trailing: const Icon(Icons.calendar_today),
                  onTap: () => _pickDate(false),),
              ListTile(
                  title: Text(t.x('accounting.due_date')),
                  subtitle: Text(DateFormat('yyyy-MM-dd').format(_dueDate)),
                  trailing: const Icon(Icons.calendar_today),
                  onTap: () => _pickDate(true),),
              for (var i = 0; i < _lines.length; i++)
                Card(
                    child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(children: [
                    DropdownButtonFormField<String>(
                      initialValue: _lines[i].accountId,
                      isExpanded: true,
                      decoration: InputDecoration(
                          labelText: t.x('accounting.account_name'),),
                      items: accounts
                          .map((row) => DropdownMenuItem(
                              value: '${row['id']}',
                              child: Text('${row['code']} · ${row['name']}',
                                  overflow: TextOverflow.ellipsis,),),)
                          .toList(),
                      onChanged: (value) =>
                          setState(() => _lines[i].accountId = value),
                    ),
                    TextField(
                        controller: _lines[i].description,
                        decoration: InputDecoration(
                            labelText: t.x('accounting.description'),),),
                    TextField(
                        controller: _lines[i].amount,
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,),
                        decoration: InputDecoration(
                            labelText: t.x('accounting.amount'),),),
                    TextField(
                        controller: _lines[i].gstRate,
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,),
                        decoration: InputDecoration(
                            labelText: t.x('accounting.gst_rate'),),),
                    if (_lines.length > 1)
                      TextButton.icon(
                          onPressed: () => setState(() {
                                _lines.removeAt(i).dispose();
                              }),
                          icon: const Icon(Icons.remove),
                          label: Text(t.x('accounting.remove_line')),),
                  ],),
                ),),
              TextButton.icon(
                  onPressed: () => setState(() => _lines.add(_BillLine())),
                  icon: const Icon(Icons.add),
                  label: Text(t.x('accounting.add_line')),),
              FilledButton(
                  onPressed: _busy ? null : _save,
                  child: Text(t.x('accounting.create_bill')),),
            ],);
          },),
    );
  }
}

class BillDetailScreen extends ConsumerStatefulWidget {
  const BillDetailScreen({required this.id, super.key});
  final String id;
  @override
  ConsumerState<BillDetailScreen> createState() => _BillDetailScreenState();
}

class _BillDetailScreenState extends ConsumerState<BillDetailScreen> {
  Map<String, dynamic>? _bill;
  bool _busy = false;
  String? _error;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final bill = await ref.read(accountingServiceProvider).getBill(widget.id);
      if (mounted) setState(() => _bill = bill);
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _act(String action, [Map<String, dynamic>? values]) async {
    setState(() => _busy = true);
    try {
      await ref
          .read(accountingServiceProvider)
          .billAction(widget.id, action, values);
      await _load();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$error')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pay() async {
    final t = T.of(ref);
    final accounts = await ref.read(accountingServiceProvider).listCoA();
    if (!mounted) return;
    final paymentAccounts = accounts
        .where((row) =>
            row['isActive'] == true &&
            ['cash', 'bank'].contains(row['subType']),)
        .toList();
    final amount = TextEditingController(
        text:
            '${_amount(_bill?['totalAmount']) - _amount(_bill?['paidAmount'])}',);
    final tds = TextEditingController(text: '0');
    String? accountId;
    DateTime date = DateTime.now();
    final values = await showDialog<Map<String, dynamic>>(
        context: context,
        builder: (dialogContext) => StatefulBuilder(
              builder: (dialogContext, update) => AlertDialog(
                title: Text(t.x('accounting.pay_bill')),
                content: SingleChildScrollView(
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                  TextField(
                      controller: amount,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      decoration:
                          InputDecoration(labelText: t.x('accounting.amount')),),
                  TextField(
                      controller: tds,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      decoration: InputDecoration(
                          labelText: t.x('accounting.tds_amount'),),),
                  DropdownButtonFormField<String>(
                      initialValue: accountId,
                      isExpanded: true,
                      decoration: InputDecoration(
                          labelText: t.x('accounting.payment_account'),),
                      items: paymentAccounts
                          .map((row) => DropdownMenuItem(
                              value: '${row['id']}',
                              child: Text('${row['code']} · ${row['name']}',
                                  overflow: TextOverflow.ellipsis,),),)
                          .toList(),
                      onChanged: (value) => update(() => accountId = value),),
                  ListTile(
                      title: Text(t.x('accounting.payment_date')),
                      subtitle: Text(DateFormat('yyyy-MM-dd').format(date)),
                      onTap: () async {
                        final picked = await showDatePicker(
                            context: dialogContext,
                            initialDate: date,
                            firstDate: DateTime(2000),
                            lastDate: DateTime(2100),);
                        if (picked != null) update(() => date = picked);
                      },),
                ],),),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(dialogContext),
                      child: Text(t.x('common.cancel')),),
                  FilledButton(
                      onPressed: () {
                        final money = RegExp(r'^\d+(\.\d{1,2})?$');
                        if (accountId == null ||
                            !money.hasMatch(amount.text.trim()) ||
                            !money.hasMatch(tds.text.trim()) ||
                            double.parse(amount.text) <= 0 ||
                            double.parse(tds.text) > double.parse(amount.text)) {
                          return;
                        }
                        Navigator.pop(dialogContext, {
                          'amount': double.parse(amount.text),
                          'tdsAmount': double.parse(tds.text),
                          'payFromAccountId': accountId,
                          'date': DateFormat('yyyy-MM-dd').format(date),
                        });
                      },
                      child: Text(t.x('accounting.pay_bill')),),
                ],
              ),
            ),);
    amount.dispose();
    tds.dispose();
    if (values != null) await _act('pay', values);
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    final fmt = ref.watch(currencyFmtProvider);
    final role = ref.watch(authControllerProvider).user?.role;
    final canWrite = role == UserRole.admin ||
        role == UserRole.superadmin ||
        role == UserRole.developer;
    final canCancel = role == UserRole.superadmin || role == UserRole.developer;
    final status = _bill?['status']?.toString();
    final lines = (_bill?['lines'] as List<dynamic>? ?? [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
    return Scaffold(
      appBar:
          AppBar(title: Text('${_bill?['billNo'] ?? t.x('accounting.bills')}')),
      body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            if (_busy && _bill == null)
              const Center(child: CircularProgressIndicator()),
            if (_error != null)
              ListTile(title: Text('${t.x('common.error')}: $_error')),
            if (_bill != null) ...[
              ListTile(
                  title: Text(t.x('accounting.status')),
                  trailing: Text('$status'),),
              ListTile(
                  title: Text(t.x('accounting.total')),
                  trailing: Text(fmt.format(_amount(_bill!['totalAmount']))),),
              ListTile(
                  title: Text(t.x('accounting.paid_amount')),
                  trailing: Text(fmt.format(_amount(_bill!['paidAmount']))),),
              ListTile(
                  title: Text(t.x('accounting.due_date')),
                  trailing: Text('${_bill!['dueDate']}'.split('T').first),),
              for (final line in lines)
                ListTile(
                    title: Text('${(line['account'] as Map?)?['name'] ?? ''}'),
                    subtitle: Text(
                        '${t.x('accounting.gst_rate')}: ${line['gstRate']}%',),
                    trailing: Text(fmt.format(
                        _amount(line['amount']) + _amount(line['gstAmount']),),),),
              Wrap(spacing: 8, children: [
                if (canWrite && status == 'draft')
                  FilledButton(
                      onPressed: _busy ? null : () => _act('post'),
                      child: Text(t.x('accounting.post_bill')),),
                if (canWrite && (status == 'unpaid' || status == 'partial'))
                  FilledButton(
                      onPressed: _busy ? null : _pay,
                      child: Text(t.x('accounting.pay_bill')),),
                if (canCancel && status == 'draft')
                  OutlinedButton(
                      onPressed: _busy ? null : () => _act('cancel'),
                      child: Text(t.x('accounting.cancel_bill')),),
              ],),
            ],
          ],),),
    );
  }
}
