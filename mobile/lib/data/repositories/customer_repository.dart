import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/data/models/customer.dart';
import 'package:zolofund/data/services/customer_service.dart';

class CustomerRepository {
  CustomerRepository(this._service);
  final CustomerService _service;

  Future<List<Customer>> list({
    String? query,
    String? cursor,
    int? limit,
    bool? hasActiveLoan,
    String? status,
    String? routeId,
  }) =>
      _service.list(
        query: query,
        cursor: cursor,
        limit: limit,
        hasActiveLoan: hasActiveLoan,
        status: status,
        routeId: routeId,
      );
  Future<Customer> getById(String id) => _service.getById(id);
  Future<Customer> create({
    required String name,
    required String phone,
    String? address,
    String? aadharNumber,
    String? routeId,
    String? agentId,
    String? photoUrl,
    List<KycDocInput> kycDocs = const [],
    Map<String, dynamic> extra = const {},
  }) =>
      _service.create(
        name: name,
        phone: phone,
        address: address,
        aadharNumber: aadharNumber,
        routeId: routeId,
        agentId: agentId,
        photoUrl: photoUrl,
        kycDocs: kycDocs,
        extra: extra,
      );
  Future<Customer> update(String id, Map<String, dynamic> patch) =>
      _service.update(id, patch);
  Future<void> delete(String id) => _service.delete(id);
  Future<List<int>> collectionReceiptPdf(String id) =>
      _service.collectionReceiptPdf(id);
}

final customerRepositoryProvider = Provider<CustomerRepository>(
  (ref) => CustomerRepository(ref.watch(customerServiceProvider)),
);

/// Filter state for the customer list screen.
class CustomerListFilter {
  const CustomerListFilter({
    this.query = '',
    this.status = 'all',
    this.hasActiveLoan,
    this.routeId,
  });
  final String query;
  final String status; // all | active | pending_review | suspended | inactive
  final bool? hasActiveLoan;
  final String? routeId; // null = all routes

  CustomerListFilter copyWith({
    String? query,
    String? status,
    bool? hasActiveLoan,
    bool clearHasActiveLoan = false,
    String? routeId,
    bool clearRoute = false,
  }) =>
      CustomerListFilter(
        query: query ?? this.query,
        status: status ?? this.status,
        hasActiveLoan:
            clearHasActiveLoan ? null : (hasActiveLoan ?? this.hasActiveLoan),
        routeId: clearRoute ? null : (routeId ?? this.routeId),
      );
}

/// autoDispose so the New Loan customer search never leaks into this list (CUST-03).
final customerFilterProvider = StateProvider.autoDispose<CustomerListFilter>(
  (ref) => const CustomerListFilter(),
);

final customerListProvider =
    FutureProvider.autoDispose<List<Customer>>((ref) async {
  final filter = ref.watch(customerFilterProvider);
  // Status and route filter on the server, same as web (CUST-03).
  final all = await ref.watch(customerRepositoryProvider).list(
        query: filter.query.isEmpty ? null : filter.query,
        hasActiveLoan: filter.hasActiveLoan,
        status: filter.status,
        routeId: filter.routeId,
      );
  var list = all;
  if (filter.hasActiveLoan != null) {
    list = list
        .where((c) => filter.hasActiveLoan! ? c.hasActiveLoan : !c.hasActiveLoan)
        .toList(growable: false);
  }
  return list;
});

final customerDetailProvider =
    FutureProvider.autoDispose.family<Customer, String>((ref, id) {
  return ref.watch(customerRepositoryProvider).getById(id);
});

final loanCustomerSearchProvider = StateProvider.autoDispose<String>((ref) => '');

final loanEligibleCustomersProvider =
    FutureProvider.autoDispose<List<Customer>>((ref) async {
  final query = ref.watch(loanCustomerSearchProvider);
  final all = await ref.watch(customerRepositoryProvider).list(
        query: query.isEmpty ? null : query,
        status: 'active',
      );
  return all.where((c) => c.status == 'active').toList(growable: false);
});
