import 'dart:async';

import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/core/presentation/app_copy.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_typography.dart';
import 'package:eco_loop/features/scan/domain/models/deposit_session.dart';
import 'package:eco_loop/shared/widgets/app_badge.dart';
import 'package:eco_loop/shared/widgets/app_button.dart';
import 'package:eco_loop/shared/widgets/app_page.dart';
import 'package:eco_loop/shared/widgets/app_page_header.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../controllers/scan_controller.dart';
import '../widgets/scanner_frame.dart';

/// Scanner entry stage. Resumes an unfinished session from controller state
/// instead of checking the current route string.
class ScanScreen extends ConsumerStatefulWidget {
  const ScanScreen({super.key});

  @override
  ConsumerState<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends ConsumerState<ScanScreen> {
  bool _busy = false;
  String? _error;
  String? _requestId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final active = ref.read(activeScanSessionProvider);
      if (active != null && active.shouldResume) {
        context.go(_canonicalPath(active.stage, active.sessionId));
      }
    });
  }

  String _canonicalPath(ScanStage stage, String sessionId) => switch (stage) {
    ScanStage.binFound => AppRoutes.scanBinPath(sessionId),
    ScanStage.ready => AppRoutes.scanReadyPath(sessionId),
    ScanStage.itemDetected => AppRoutes.scanDetectedPath(sessionId),
    ScanStage.processing => AppRoutes.scanProcessingPath(sessionId),
    _ => AppRoutes.scan,
  };

  @override
  Widget build(BuildContext context) {
    final instructionsAsync = ref.watch(scanInstructionsProvider);
    final instructions = instructionsAsync.valueOrNull;
    return AppPage(
      header: AppPageHeader(
        eyebrow: AppCopy.scanSessionEyebrow,
        title: instructions?.scannerTitle ?? 'Scan a smart bin',
        onBack: () => context.go(AppRoutes.home),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const ScannerStage(
            caption: AppCopy.scanCameraCaption,
            child: ScannerFrameContent(),
          ),
          const SizedBox(height: 18),
          const Align(
            child: AppBadge(
              label: AppCopy.scannerBadge,
              tone: AppBadgeTone.gray,
            ),
          ),
          const SizedBox(height: 9),
          Text(
            instructions?.scannerTitle ?? 'Scan a smart bin',
            textAlign: TextAlign.center,
            style: AppTypography.sectionHeading,
          ),
          const SizedBox(height: 9),
          Text(
            instructions?.scannerDescription ??
                'Position the QR code inside the frame.',
            textAlign: TextAlign.center,
            style: AppTypography.body.copyWith(
              color: AppColors.muted,
              height: 1.55,
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: AppTypography.activityMetadata.copyWith(
                fontSize: 12,
                color: Theme.of(context).colorScheme.error,
              ),
            ),
          ],
          const SizedBox(height: 18),
          AppButton(
            label: 'Simulate QR scan',
            onPressed: _busy ? null : () => unawaited(_scan()),
            isLoading: _busy,
            expand: true,
          ),
          const SizedBox(height: 8),
          AppButton(
            label: AppCopy.cancel,
            variant: AppButtonVariant.ghost,
            onPressed: _busy ? null : () => context.go(AppRoutes.home),
            expand: true,
          ),
        ],
      ),
    );
  }

  Future<void> _scan() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final repository = ref.read(scanRepositoryProvider);
      final payload = await repository.getDemoQrPayload();
      final bin = await repository.lookupBin(payload);
      // One stable request ID per attempt so a retry cannot create a second
      // session for the same scan.
      _requestId ??= 'scan-${DateTime.now().microsecondsSinceEpoch}';
      final session = await repository.createSession(bin.id, _requestId!);
      _requestId = null;
      if (mounted) context.go(AppRoutes.scanBinPath(session.id));
    } on Object catch (error) {
      _requestId = null;
      if (mounted) setState(() => _error = scanFailureCopy(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}
