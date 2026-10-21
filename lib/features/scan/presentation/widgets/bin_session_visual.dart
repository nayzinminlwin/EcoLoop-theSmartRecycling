import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_typography.dart';
import 'package:eco_loop/shared/widgets/app_icon.dart';
import 'package:flutter/material.dart';

import '../../domain/models/deposit_session.dart';
import 'scanner_frame.dart';

/// Stage-aware stage visual inside the dark 250px scanner surface.
///
/// One stage-aware widget instead of six screens:
/// - bin found: white outlined bin + amber capacity percentage
/// - ready: bin + amber READY label
/// - item detected: camera icon inside subtle mint pulse rings
/// - processing: spinning recycle/identification icon
/// - completed: primary-green surface with a white check success ring
///
/// Animations switch to static equivalents when the platform asks for
/// reduced motion; they never drive transaction state.
class ScanStageVisual extends StatelessWidget {
  const ScanStageVisual({
    required this.stage,
    required this.capacityPercent,
    super.key,
    this.outcomeTone = ScanStageOutcomeTone.neutral,
  });

  final ScanStage stage;
  final int capacityPercent;
  final ScanStageOutcomeTone outcomeTone;

  @override
  Widget build(BuildContext context) {
    final reduceMotion =
        MediaQuery.disableAnimationsOf(context) ||
        MediaQuery.of(context).accessibleNavigation;
    return switch (stage) {
      ScanStage.binFound || ScanStage.ready => ScannerStage(
        child: _BinVisual(
          label: stage == ScanStage.binFound ? '$capacityPercent%' : 'READY',
        ),
      ),
      ScanStage.itemDetected => ScannerStage(
        child: PulseCircle(
          animate: !reduceMotion,
          child: const AppIcon('camera', size: 52, color: Color(0xFF81D1A5)),
        ),
      ),
      ScanStage.processing => ScannerStage(
        child: SpinningIcon(
          child: Image.asset('assets/icons/recycle.png', width: 48, height: 48),
        ),
      ),
      ScanStage.completed => ScannerStage(
        success: true,
        child: PulseCircle(
          onWhite: true,
          child: AppIcon(
            'check',
            size: 54,
            color: switch (outcomeTone) {
              ScanStageOutcomeTone.green => Colors.white,
              ScanStageOutcomeTone.amber => AppColors.amber,
              ScanStageOutcomeTone.red => AppColors.red,
              ScanStageOutcomeTone.neutral => Colors.white,
            },
          ),
        ),
      ),
      ScanStage.cancelled => ScannerStage(
        child: const AppIcon('bin', size: 74, color: Colors.white),
      ),
    };
  }
}

enum ScanStageOutcomeTone { green, amber, red, neutral }

class _BinVisual extends StatelessWidget {
  const _BinVisual({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      const AppIcon('bin', size: 74, color: Colors.white),
      const SizedBox(height: 14),
      Text(
        label,
        style: AppTypography.sectionHeading.copyWith(
          fontSize: 18,
          color: AppColors.amber,
          fontWeight: FontWeight.w800,
          letterSpacing: label == 'READY' ? 1 : -0.38,
        ),
      ),
    ],
  );
}
