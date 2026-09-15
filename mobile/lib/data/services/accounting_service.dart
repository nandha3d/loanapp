// ignore_for_file: require_trailing_commas

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:zolofund/core/network/dio_client.dart';
import 'package:zolofund/shared/constants/endpoints.dart';

class AccountingService {
  AccountingService(this._dio);
  final Dio _dio;

  // --- Chart of Accounts ---
  Future<List<Map<String, dynamic>>> listCoA(
      {bool showInactive = false}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.accountingCoa,
      queryParameters: {'showInactive': showInactive.toString()},
    );
    return unwrapEnvelope(res, (dynamic d) {
      final list = (d as List<dynamic>);
      return list
          .map((dynamic e) => Map<String, dynamic>.from(e as Map))
          .toList();
    });
  }

  Future<void> createCoAAccount({
    required String code,
    required String name,
    required String classType,
    String? subType,
    String? parentId,
    bool? isCash,
    String? description,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.accountingCoa,
      data: {
        'code': code,
        'name': name,
        'classType': classType,
        if (subType != null) 'subType': subType,
        if (parentId != null) 'parentId': parentId,
        if (isCash != null) 'isCash': isCash,
        if (description != null) 'description': description,
      },
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  Future<void> updateCoAAccount(
    String id, {
    String? name,
    String? subType,
    String? parentId,
    bool? isCash,
    String? description,
    bool? isActive,
  }) async {
    final res = await _dio.patch<Map<String, dynamic>>(
      Endpoints.accountingCoa,
      data: {
        'id': id,
        if (name != null) 'name': name,
        if (subType != null) 'subType': subType,
        if (parentId != null) 'parentId': parentId,
        if (isCash != null) 'isCash': isCash,
        if (description != null) 'description': description,
        if (isActive != null) 'isActive': isActive,
      },
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  Future<void> toggleCoAAccount(String id) async {
    final res = await _dio.patch<Map<String, dynamic>>(
      Endpoints.accountingCoa,
      data: {'id': id, 'action': 'toggle'},
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  Future<void> reseedCoA() async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.accountingCoa,
      data: {'action': 'reseed'},
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  // --- Journal Entries ---
  Future<Map<String, dynamic>> listJournals({
    String? from,
    String? to,
    String? status,
    String? search,
    int? page,
  }) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.accountingJournal,
      queryParameters: {
        if (from != null) 'from': from,
        if (to != null) 'to': to,
        if (status != null) 'status': status,
        if (search != null) 'search': search,
        if (page != null) 'page': page.toString(),
      },
    );
    return unwrapEnvelope(
        res, (dynamic d) => Map<String, dynamic>.from(d as Map));
  }

  Future<Map<String, dynamic>> getJournal(String id) async {
    final res = await _dio
        .get<Map<String, dynamic>>(Endpoints.accountingJournalDetail(id));
    return unwrapEnvelope(
        res, (dynamic d) => Map<String, dynamic>.from(d as Map));
  }

  Future<void> postJournal({
    required String entryDate,
    String? narration,
    String? branchId,
    required List<Map<String, dynamic>> lines,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.accountingJournal,
      data: {
        'entryDate': entryDate,
        if (narration != null) 'narration': narration,
        if (branchId != null) 'branchId': branchId,
        'lines': lines,
      },
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  Future<void> draftJournal({
    required String entryDate,
    String? narration,
    String? branchId,
    required List<Map<String, dynamic>> lines,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.accountingJournal,
      data: {
        'action': 'draft',
        'entryDate': entryDate,
        if (narration != null) 'narration': narration,
        if (branchId != null) 'branchId': branchId,
        'lines': lines,
      },
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  Future<void> approveJournal(String id) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.accountingJournalDetail(id),
      data: {'action': 'approve'},
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  Future<void> rejectJournal(String id, String note) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.accountingJournalDetail(id),
      data: {'action': 'reject', 'note': note},
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  Future<void> reverseJournal(String id, String reason) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.accountingJournalDetail(id),
      data: {'action': 'reverse', 'reason': reason},
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  Future<void> postDraftJournal(String id) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.accountingJournalDetail(id),
      data: {'action': 'post_draft'},
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  Future<void> deleteDraftJournal(String id) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.accountingJournalDetail(id),
      data: {'action': 'delete_draft'},
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  // --- Financial Statements ---
  Future<Map<String, dynamic>> getPnL({String? from, String? to}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.accountingPnl,
      queryParameters: {
        if (from != null) 'from': from,
        if (to != null) 'to': to,
      },
    );
    return unwrapEnvelope(
        res, (dynamic d) => Map<String, dynamic>.from(d as Map));
  }

  Future<Map<String, dynamic>> getBalanceSheet({String? asOf}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.accountingBalanceSheet,
      queryParameters: {
        if (asOf != null) 'asOf': asOf,
      },
    );
    return unwrapEnvelope(
        res, (dynamic d) => Map<String, dynamic>.from(d as Map));
  }

  Future<Map<String, dynamic>> getTrialBalance({String? asOf}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.accountingTrialBalance,
      queryParameters: {
        if (asOf != null) 'asOf': asOf,
      },
    );
    return unwrapEnvelope(
        res, (dynamic d) => Map<String, dynamic>.from(d as Map));
  }

  Future<Map<String, dynamic>> getCashflow({String? from, String? to}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.accountingCashflow,
      queryParameters: {
        if (from != null) 'from': from,
        if (to != null) 'to': to,
      },
    );
    return unwrapEnvelope(
        res, (dynamic d) => Map<String, dynamic>.from(d as Map));
  }

  Future<List<Map<String, dynamic>>> listAccountingApprovals({
    String? status,
    String? entityType,
  }) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.accountingApprovals,
      queryParameters: {
        if (status != null) 'status': status,
        if (entityType != null) 'entityType': entityType,
      },
    );
    return unwrapEnvelope(res, (dynamic d) {
      return (d as List<dynamic>)
          .map((dynamic e) => Map<String, dynamic>.from(e as Map))
          .toList();
    });
  }

  Future<void> reviewAccountingApproval({
    required String approvalId,
    required String action,
    String? note,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.accountingApprovals,
      data: {
        'approvalId': approvalId,
        'action': action,
        if (note != null) 'note': note,
      },
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  Future<List<Map<String, dynamic>>> listBudgets({String? periodKey}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.accountingBudget,
      queryParameters: {
        if (periodKey != null) 'periodKey': periodKey,
      },
    );
    return unwrapEnvelope(res, (dynamic d) {
      return (d as List<dynamic>)
          .map((dynamic e) => Map<String, dynamic>.from(e as Map))
          .toList();
    });
  }

  Future<Map<String, dynamic>> getTaxSummary({String? periodKey}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.accountingTax,
      queryParameters: {
        if (periodKey != null) 'periodKey': periodKey,
      },
    );
    return unwrapEnvelope(
        res, (dynamic d) => Map<String, dynamic>.from(d as Map));
  }

  Future<List<Map<String, dynamic>>> listVendors({String? search}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.accountingVendors,
      queryParameters: {
        if (search != null && search.isNotEmpty) 'search': search,
      },
    );
    return unwrapEnvelope(res, (dynamic d) {
      return (d as List<dynamic>)
          .map((dynamic e) => Map<String, dynamic>.from(e as Map))
          .toList();
    });
  }

  Future<List<Map<String, dynamic>>> listExportRuns() async {
    final res =
        await _dio.get<Map<String, dynamic>>(Endpoints.accountingExport);
    return unwrapEnvelope(res, (dynamic d) {
      return (d as List<dynamic>)
          .map((dynamic e) => Map<String, dynamic>.from(e as Map))
          .toList();
    });
  }

  Future<Map<String, dynamic>> getPremiumSettings() async {
    final res =
        await _dio.get<Map<String, dynamic>>(Endpoints.accountingSettings);
    return unwrapEnvelope(
        res, (dynamic d) => Map<String, dynamic>.from(d as Map));
  }

  // --- Bank Reconciliation ---
  Future<Map<String, dynamic>> listBankAccounts() async {
    final res =
        await _dio.get<Map<String, dynamic>>(Endpoints.accountingBankRec);
    return unwrapEnvelope(
        res, (dynamic d) => Map<String, dynamic>.from(d as Map));
  }

  Future<Map<String, dynamic>> getBankAccountDetail(
      String bankAccountId) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.accountingBankRec,
      queryParameters: {'bankAccountId': bankAccountId},
    );
    return unwrapEnvelope(
        res, (dynamic d) => Map<String, dynamic>.from(d as Map));
  }

  Future<Map<String, dynamic>> getStatementWithLines(String statementId,
      {bool showUnmatchedOnly = false}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.accountingBankRec,
      queryParameters: {
        'statementId': statementId,
        'showUnmatchedOnly': showUnmatchedOnly.toString(),
      },
    );
    return unwrapEnvelope(
        res, (dynamic d) => Map<String, dynamic>.from(d as Map));
  }

  Future<void> createBankAccount({
    required String name,
    required String bankName,
    required String accountNo,
    String? ifsc,
    required String ledgerAccountId,
    required double openingBalance,
    required String openingAsOf,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.accountingBankRec,
      data: {
        'action': 'create_account',
        'name': name,
        'bankName': bankName,
        'accountNo': accountNo,
        if (ifsc != null) 'ifsc': ifsc,
        'ledgerAccountId': ledgerAccountId,
        'openingBalance': openingBalance,
        'openingAsOf': openingAsOf,
      },
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  Future<void> importStatement({
    required String bankAccountId,
    required List<Map<String, dynamic>> rows,
    required String statementFrom,
    required String statementTo,
    required double openingBalance,
    required double closingBalance,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.accountingBankRec,
      data: {
        'action': 'import_statement',
        'bankAccountId': bankAccountId,
        'rows': rows,
        'statementFrom': statementFrom,
        'statementTo': statementTo,
        'openingBalance': openingBalance,
        'closingBalance': closingBalance,
      },
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  Future<void> acceptMatchProposal(String proposalId) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.accountingBankRec,
      data: {
        'action': 'accept_proposal',
        'proposalId': proposalId,
      },
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  Future<void> rejectMatchProposal(String proposalId) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.accountingBankRec,
      data: {
        'action': 'reject_proposal',
        'proposalId': proposalId,
      },
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  Future<void> ignoreLine(String statementLineId) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.accountingBankRec,
      data: {
        'action': 'ignore_line',
        'statementLineId': statementLineId,
      },
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  Future<void> unmatchLine(String statementLineId) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.accountingBankRec,
      data: {
        'action': 'unmatch_line',
        'statementLineId': statementLineId,
      },
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  Future<void> reconcileStatement(String statementId) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.accountingBankRec,
      data: {
        'action': 'reconcile_statement',
        'statementId': statementId,
      },
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  // --- Periods ---
  Future<List<Map<String, dynamic>>> listPeriods({String? fiscalYear}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      Endpoints.accountingPeriods,
      queryParameters: {
        if (fiscalYear != null) 'fiscalYear': fiscalYear,
      },
    );
    return unwrapEnvelope(res, (dynamic d) {
      final list = (d as List<dynamic>);
      return list
          .map((dynamic e) => Map<String, dynamic>.from(e as Map))
          .toList();
    });
  }

  Future<void> softLockPeriod(String periodId, [String? reason]) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.accountingPeriods,
      data: {
        'action': 'soft_lock',
        'periodId': periodId,
        if (reason != null) 'reason': reason,
      },
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  Future<void> lockPeriod(String periodId, [String? reason]) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.accountingPeriods,
      data: {
        'action': 'lock',
        'periodId': periodId,
        if (reason != null) 'reason': reason,
      },
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  Future<void> closePeriod(String periodId) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.accountingPeriods,
      data: {
        'action': 'close',
        'periodId': periodId,
      },
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  Future<void> unlockPeriod(String periodId, String reason) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.accountingPeriods,
      data: {
        'action': 'unlock',
        'periodId': periodId,
        'reason': reason,
      },
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }

  Future<void> reopenPeriod(String periodId, String reason) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.accountingPeriods,
      data: {
        'action': 'reopen',
        'periodId': periodId,
        'reason': reason,
      },
    );
    unwrapEnvelope(res, (dynamic d) => d);
  }
}

final accountingServiceProvider = Provider<AccountingService>((ref) {
  return AccountingService(ref.watch(dioProvider));
});
