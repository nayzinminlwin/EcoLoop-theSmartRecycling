import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/core/presentation/app_copy.dart';
import 'package:eco_loop/shared/widgets/app_button.dart';
import 'package:eco_loop/shared/widgets/app_page.dart';

import '../widgets/scanner_frame.dart';

class ScanScreen extends ConsumerStatefulWidget {
  const ScanScreen({super.key});
  @override
  ConsumerState<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends ConsumerState<ScanScreen> {
  bool _busy = false;
  String? _error;

  @override
  Widget build(BuildContext context) => AppPage(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Scan a smart bin',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 8),
        const Text('Scan the QR code on a nearby bin to start recycling.'),
        const SizedBox(height: 24),
        const ScannerFrame(),
        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(
            _error!,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        ],
        const SizedBox(height: 20),
        AppButton(
          label: _busy ? 'Looking for bin...' : 'Simulate QR scan',
          onPressed: _busy ? null : _scan,
        ),
      ],
    ),
  );

  Future<void> _scan() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final repository = ref.read(scanRepositoryProvider);
      final payload = await repository.getDemoQrPayload();
      final bin = await repository.lookupBin(payload);
      final session = await repository.createSession(
        bin.id,
        'scan-${DateTime.now().microsecondsSinceEpoch}',
      );
      if (mounted) context.go(AppRoutes.scanBinPath(session.id));
    } catch (_) {
      if (mounted) setState(() => _error = AppCopy.scanUnavailable);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}
