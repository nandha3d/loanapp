import 'package:loantrack/core/currency/currency_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import 'package:loantrack/core/l10n/language_controller.dart';
import 'package:loantrack/core/theme/app_colors.dart';
import 'package:loantrack/data/services/collection_service.dart';

/// Full-screen QR scanner for the agent. Scans the client's payment QR
/// (`loanpay:<token>`), auto-confirms via the API, and pops with the result.
class QrScanScreen extends ConsumerStatefulWidget {
  const QrScanScreen({super.key});

  @override
  ConsumerState<QrScanScreen> createState() => _QrScanScreenState();
}

class _QrScanScreenState extends ConsumerState<QrScanScreen> {
  final _controller = MobileScannerController();
  bool _handling = false;
  String? _status;
  bool _error = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_handling) return;
    final raw = capture.barcodes.isNotEmpty ? capture.barcodes.first.rawValue : null;
    if (raw == null) return;
    if (!raw.startsWith('loanpay:')) return; // ignore unrelated codes
    final token = raw.substring('loanpay:'.length).trim();
    if (token.isEmpty) return;

    setState(() {
      _handling = true;
      _status = 'Confirming payment…';
      _error = false;
    });
    await _controller.stop();
    final t = T.of(ref);
    try {
      final applied = await ref.read(collectionServiceProvider).submitQrProof(token);
      if (!mounted) return;
      final fmt = ref.watch(currencyFmtProvider);
      setState(() => _status = '${t.x('proof.qr_confirmed')} ${fmt.format(applied)}');
      await Future<void>.delayed(const Duration(milliseconds: 900));
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = true;
        _status = e.toString().replaceFirst('Exception: ', '');
        _handling = false;
      });
      await _controller.start();
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.of(ref);
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(t.x('proof.scan_title')),
      ),
      body: Stack(
        children: [
          MobileScanner(controller: _controller, onDetect: _onDetect),
          // Reticle
          Center(
            child: Container(
              width: 240,
              height: 240,
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.primary, width: 3),
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 48,
            child: Column(
              children: [
                if (_status != null)
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 32),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: _error ? AppColors.danger : Colors.black54,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      _status!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                    ),
                  )
                else
                  Text(
                    t.x('proof.scan_hint'),
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white70),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
