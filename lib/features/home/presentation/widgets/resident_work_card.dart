import 'dart:async';

import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_typography.dart';
import 'package:eco_loop/features/scan/domain/models/deposit_result.dart';
import 'package:eco_loop/features/scan/domain/models/deposit_session.dart';
import 'package:eco_loop/features/scan/presentation/controllers/scan_controller.dart';
import 'package:eco_loop/shared/widgets/app_badge.dart';
import 'package:eco_loop/shared/widgets/app_button.dart';
import 'package:eco_loop/shared/widgets/app_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ResidentWorkCard extends ConsumerStatefulWidget {
  const ResidentWorkCard({super.key});

  @override
  ConsumerState<ResidentWorkCard> createState() => _ResidentWorkCardState();
}

class _ResidentWorkCardState extends ConsumerState<ResidentWorkCard> {
  Timer? _timer;
  Timer? _resultDismissTimer;
  DateTime _now = DateTime.now();
  String? _scheduledResultId;

  @override
  void initState() {
    super.initState();
    _now = ref.read(appClockProvider).now;
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _now = ref.read(appClockProvider).now);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _resultDismissTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final work = ref.watch(activeScanSessionProvider);
    if (work == null) return const SizedBox.shrink();

    final session = work.session;
    final startedAt =
        session?.progress?.submissionAt ??
        session?.submittedAt ??
        session?.updatedAt;
    final elapsed = startedAt == null
        ? null
        : _formatElapsed(_now.difference(startedAt));
    final completed = work.stage == ScanStage.completed;
    final result = work.result;
    if (completed && result != null && work.resultSeen) {
      return const SizedBox.shrink();
    }
    if (completed && result != null && !work.resultSeen) {
      _scheduleResultDismissal(result.id);
    }
    final title = completed ? _resultTitle(result) : _stageTitle(work.stage);
    final description = completed
        ? result == null
              ? 'Loading your result'
              : 'Your deposit result is ready to view.'
        : '${elapsed == null ? 'Submitted deposit' : 'Processing · $elapsed'}'
              ' · ${_stageTitle(work.stage)}';

    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: AppCard(
        variant: AppCardVariant.elevated,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Your recycling',
                    style: AppTypography.sectionHeading,
                  ),
                ),
                AppBadge(
                  label: completed ? 'Ready' : 'In progress',
                  tone: completed ? AppBadgeTone.green : AppBadgeTone.amber,
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(title, style: AppTypography.sectionHeading),
            const SizedBox(height: 4),
            Text(
              description,
              style: AppTypography.activityMetadata.copyWith(
                color: AppColors.muted,
              ),
            ),
            const SizedBox(height: 14),
            AppButton(
              label: completed ? 'View result' : 'View progress',
              onPressed: () => _openWork(context, work),
              expand: true,
            ),
          ],
        ),
      ),
    );
  }

  void _scheduleResultDismissal(String resultId) {
    if (_scheduledResultId == resultId) return;
    _scheduledResultId = resultId;
    _resultDismissTimer?.cancel();
    _resultDismissTimer = Timer(const Duration(seconds: 5), () {
      if (!mounted) return;
      final work = ref.read(activeScanSessionProvider);
      if (work?.result?.id == resultId && !work!.resultSeen) {
        ref.read(activeScanSessionProvider.notifier).markResultSeen();
      }
    });
  }

  void _openWork(BuildContext context, ActiveScanSession work) {
    if (work.stage == ScanStage.completed && work.result != null) {
      ref.read(activeScanSessionProvider.notifier).markResultSeen();
    }
    final path = switch (work.stage) {
      ScanStage.binFound => AppRoutes.scanBinPath(work.sessionId),
      ScanStage.ready => AppRoutes.scanReadyPath(work.sessionId),
      ScanStage.itemDetected => AppRoutes.scanDetectedPath(work.sessionId),
      ScanStage.processing => AppRoutes.scanProcessingPath(work.sessionId),
      ScanStage.completed => AppRoutes.scanResultPath(work.sessionId),
      ScanStage.cancelled => AppRoutes.scan,
    };
    context.go(path);
  }

  String _stageTitle(ScanStage stage) => switch (stage) {
    ScanStage.binFound => 'Smart bin session ready',
    ScanStage.ready => 'Ready to recycle',
    ScanStage.itemDetected => 'Image ready for verification',
    ScanStage.processing => 'Verification in progress',
    ScanStage.completed => 'Deposit result ready',
    ScanStage.cancelled => 'Scan cancelled',
  };

  String _resultTitle(DepositResult? result) => switch (result?.outcome) {
    DepositOutcome.verified => 'Deposit verified',
    DepositOutcome.review => 'Deposit sent for review',
    DepositOutcome.empty => 'No recyclable items detected',
    DepositOutcome.rejected => 'Deposit not eligible',
    DepositOutcome.processing => 'Verification in progress',
    _ => 'Loading your result',
  };

  String _formatElapsed(Duration duration) {
    final safeDuration = duration.isNegative ? Duration.zero : duration;
    final minutes = safeDuration.inMinutes;
    final seconds = safeDuration.inSeconds.remainder(60);
    return '${minutes.toString().padLeft(2, '0')}:'
        '${seconds.toString().padLeft(2, '0')}';
  }
}
