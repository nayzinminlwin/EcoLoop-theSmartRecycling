import 'dart:async';

import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_typography.dart';
import 'package:eco_loop/features/scan/domain/models/deposit_session.dart';
import 'package:flutter/material.dart';

class ScanProgressCard extends StatefulWidget {
  const ScanProgressCard({required this.session, super.key, this.now});

  final DepositSession session;
  final DateTime Function()? now;

  @override
  State<ScanProgressCard> createState() => _ScanProgressCardState();
}

class _ScanProgressCardState extends State<ScanProgressCard> {
  Timer? _timer;
  late DateTime _now;

  @override
  void initState() {
    super.initState();
    _now = _readNow();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _now = _readNow());
    });
  }

  @override
  void didUpdateWidget(covariant ScanProgressCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.session.updatedAt != widget.session.updatedAt) {
      _now = _readNow();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  DateTime _readNow() => widget.now?.call() ?? DateTime.now();

  @override
  Widget build(BuildContext context) {
    final progress = ScanProgress.fromSession(widget.session, now: _now);
    final elapsed = _now.difference(widget.session.updatedAt);
    final elapsedText = _formatElapsed(
      elapsed.isNegative ? Duration.zero : elapsed,
    );

    return Semantics(
      liveRegion: true,
      label:
          '${progress.activeMessage}. Step ${progress.step} of 5. '
          'Elapsed $elapsedText.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Processing',
            textAlign: TextAlign.center,
            style: AppTypography.badge.copyWith(
              color: AppColors.primaryDark,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Step ${progress.step} of 5 · $elapsedText',
            textAlign: TextAlign.center,
            style: AppTypography.activityMetadata.copyWith(
              fontSize: 12,
              color: AppColors.muted,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              for (var index = 1; index <= 5; index++)
                Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(right: index == 5 ? 0 : 6),
                    child: _ProgressSegment(
                      state: index < progress.step
                          ? _SegmentState.complete
                          : index == progress.step
                          ? _SegmentState.active
                          : _SegmentState.next,
                      label: 'Step $index',
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            progress.activeMessage,
            textAlign: TextAlign.center,
            style: AppTypography.sectionHeading,
          ),
          if (progress.detailMessage != null) ...[
            const SizedBox(height: 6),
            Text(
              progress.detailMessage!,
              textAlign: TextAlign.center,
              style: AppTypography.body.copyWith(
                color: AppColors.muted,
                height: 1.45,
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _formatElapsed(Duration duration) {
    final minutes = duration.inMinutes;
    final seconds = duration.inSeconds.remainder(60);
    return '${minutes.toString().padLeft(2, '0')}:'
        '${seconds.toString().padLeft(2, '0')}';
  }
}

enum _SegmentState { complete, active, next }

class _ProgressSegment extends StatelessWidget {
  const _ProgressSegment({required this.state, required this.label});

  final _SegmentState state;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label:
          '$label: ${switch (state) {
            _SegmentState.complete => 'complete',
            _SegmentState.active => 'in progress',
            _SegmentState.next => 'up next',
          }}',
      child: switch (state) {
        _SegmentState.complete => _segment(color: AppColors.primaryDark),
        _SegmentState.active => const _BreathingSegment(),
        _SegmentState.next => _segment(color: AppColors.sage),
      },
    );
  }

  Widget _segment({required Color color}) => DecoratedBox(
    decoration: BoxDecoration(
      color: color,
      borderRadius: BorderRadius.circular(10),
    ),
    child: const SizedBox(height: 10),
  );
}

class _BreathingSegment extends StatefulWidget {
  const _BreathingSegment();

  @override
  State<_BreathingSegment> createState() => _BreathingSegmentState();
}

class _BreathingSegmentState extends State<_BreathingSegment>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _controller,
    builder: (context, child) => DecoratedBox(
      decoration: BoxDecoration(
        color: Color.lerp(
          AppColors.primary,
          AppColors.scannerCorner,
          _controller.value,
        ),
        borderRadius: BorderRadius.circular(10),
      ),
      child: child,
    ),
    child: const SizedBox(height: 10),
  );
}

class ScanProgress {
  const ScanProgress({
    required this.step,
    required this.activeMessage,
    this.detailMessage,
  });

  final int step;
  final String activeMessage;
  final String? detailMessage;

  factory ScanProgress.fromSession(DepositSession session, {DateTime? now}) {
    final substage = session.jobSubstage?.toLowerCase();
    if (substage == null) {
      final elapsed = (now ?? DateTime.now()).difference(session.updatedAt);
      if (elapsed >= const Duration(seconds: 45)) {
        return const ScanProgress(
          step: 4,
          activeMessage: 'Confirming materials',
          detailMessage: 'Estimated progress — waiting for verification.',
        );
      }
      if (elapsed >= const Duration(seconds: 20)) {
        return const ScanProgress(
          step: 3,
          activeMessage: 'Identifying recyclable items',
          detailMessage: 'Estimated progress — waiting for verification.',
        );
      }
      return const ScanProgress(
        step: 2,
        activeMessage: 'Validating the image',
        detailMessage: 'Estimated progress — waiting for verification.',
      );
    }
    return switch (substage) {
      'queued' || 'pending' || 'waiting' => const ScanProgress(
        step: 1,
        activeMessage: 'Request received — waiting for verification to start',
      ),
      'validating' || 'validation' || 'source_validation' => const ScanProgress(
        step: 2,
        activeMessage: 'Validating the image',
      ),
      'detecting' || 'detection' || 'identifying' => const ScanProgress(
        step: 3,
        activeMessage: 'Identifying recyclable items',
      ),
      'additional_analysis' ||
      'specialist_check' ||
      'fallback_check' => const ScanProgress(
        step: 4,
        activeMessage: 'Confirming materials',
        detailMessage: 'Some items need an additional check.',
      ),
      'retry' || 'retrying' => const ScanProgress(
        step: 3,
        activeMessage: 'Identifying recyclable items',
        detailMessage: 'We are retrying verification.',
      ),
      'finalizing' || 'settling' || 'saving' => const ScanProgress(
        step: 5,
        activeMessage: 'Saving your result',
      ),
      _ => const ScanProgress(step: 2, activeMessage: 'Validating the image'),
    };
  }
}
