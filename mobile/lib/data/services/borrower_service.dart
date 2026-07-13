import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:loantrack/core/auth/auth_storage.dart';
import 'package:loantrack/core/network/dio_client.dart';
import 'package:loantrack/data/models/borrower.dart';
import 'package:loantrack/shared/constants/endpoints.dart';

class BorrowerService {
  BorrowerService(this._dio, [this._storage]);
  final Dio _dio;
  final AuthStorage? _storage;
  String? _challengeToken;

  /// Step 1: Request OTP for borrower phone number.
  Future<Map<String, dynamic>> login(String phone) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.borrowerLogin,
      data: {'phone': phone},
    );
    return unwrapEnvelope(res, (dynamic d) {
      final data = d as Map<String, dynamic>;
      _challengeToken = data['challengeToken'] as String?;
      return data;
    });
  }

  /// Password login (same credential as the web borrower portal). Returns
  /// and stores the session token directly — no OTP round-trip.
  Future<Map<String, dynamic>> loginWithPassword(
    String phone,
    String password,
  ) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.borrowerLogin,
      data: {'phone': phone, 'password': password},
    );
    final data = unwrapEnvelope(res, (dynamic d) => d as Map<String, dynamic>);
    final token = data['token'] as String?;
    if (token != null && _storage != null) {
      await _storage.saveSession(
        token: token,
        tenantSlug: (data['tenantSlug'] as String?) ?? '',
        appType: (data['appType'] as String?) ?? 'borrower',
      );
    }
    return data;
  }

  /// Step 2: Verify OTP and get a session token.
  Future<Map<String, dynamic>> verifyOtp(String phone, String otp) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.borrowerVerify,
      data: {
        'phone': phone,
        'otp': otp,
        if (_challengeToken != null) 'challengeToken': _challengeToken,
      },
    );
    final data = unwrapEnvelope(res, (dynamic d) => d as Map<String, dynamic>);
    final token = data['token'] as String?;
    if (token != null && _storage != null) {
      await _storage.saveSession(
        token: token,
        tenantSlug: (data['tenantSlug'] as String?) ?? '',
        appType: (data['appType'] as String?) ?? 'borrower',
      );
    }
    _challengeToken = null;
    return data;
  }

  /// Module summary + chit memberships — drives module-aware routing.
  Future<BorrowerPortal> getPortal() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.borrowerPortal);
    return unwrapEnvelope(
      res,
      (dynamic d) => BorrowerPortal.fromJson(d as Map<String, dynamic>),
    );
  }

  /// Fetch all loans for the authenticated borrower.
  Future<List<BorrowerLoan>> getLoans() async {
    final res = await _dio.get<Map<String, dynamic>>(Endpoints.borrowerLoans);
    return unwrapEnvelope(res, (dynamic d) {
      return (d as List<dynamic>)
          .map((dynamic e) => BorrowerLoan.fromJson(e as Map<String, dynamic>))
          .toList(growable: false);
    });
  }

  /// Submit a repayment.
  Future<Map<String, dynamic>> submitPayment({
    required String loanId,
    required double amount,
    required String paymentMode,
    String? referenceNumber,
    String? proofPhotoUrl,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      Endpoints.borrowerPay,
      data: {
        'loanId': loanId,
        'amount': amount,
        'paymentMode': paymentMode,
        if (referenceNumber != null && referenceNumber.isNotEmpty)
          'referenceNumber': referenceNumber,
        if (proofPhotoUrl != null) 'proofPhotoUrl': proofPhotoUrl,
      },
    );
    return unwrapEnvelope(res, (dynamic d) => d as Map<String, dynamic>);
  }

  /// Logout the borrower session.
  Future<void> logout() async {
    await _dio.post<Map<String, dynamic>>(Endpoints.borrowerLogout);
    await _storage?.clear();
  }
}

final borrowerServiceProvider = Provider<BorrowerService>(
  (ref) => BorrowerService(
    ref.watch(dioProvider),
    ref.watch(authStorageProvider),
  ),
);
