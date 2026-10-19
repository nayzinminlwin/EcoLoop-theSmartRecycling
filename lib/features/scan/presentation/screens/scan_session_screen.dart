import 'dart:async';

import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/app/router/leave_decision_coordinator.dart';
import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/core/presentation/app_copy.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_typography.dart';
import 'package:eco_loop/features/scan/domain/models/deposit_result.dart';
import 'package:eco_loop/features/scan/domain/models/deposit_session.dart';
import 'package:eco_loop/features/scan/domain/models/scan_instructions.dart';
import 'package:eco_loop/features/scan/domain/models/smart_bin.dart';
import 'package:eco_loop/shared/widgets/app_badge.dart';
import 'package:eco_loop/shared/widgets/app_button.dart';
import 'package:eco_loop/shared/widgets/app_icon.dart';
import 'package:eco_loop/shared/widgets/app_page.dart';
import 'package:eco_loop/shared/widgets/app_page_header.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../controllers/scan_controller.dart';
import '../widgets/bin_details_card.dart';
import '../widgets/bin_session_visual.dart';
import '../widgets/deposit_result_card.dart';
import '../widgets/scanner_frame.dart';

/// One reliable stateful scan flow.
///
/// The screen observes the session/bin/result by ID; stale or future-stage
/// URLs canonicalize to the committed stage state. Completion runs at app
/// scope, so leaving during processing never cancels or replays it.
class ScanSessionScreen extends ConsumerStatefulWidget {
  const ScanSessionScreen({
    required this.sessionId,
    required this.expectedStage,
    super.key,
  });

  final String sessionId;
  final ScanStage expectedStage;

  @override
  ConsumerState<ScanSessionScreen> createState() => _ScanSessionScreenState();
}

class _ScanSessionScreenState extends ConsumerState<ScanSessionScreen> {
  VoidCallback? _leaveGuardDisposer;
  bool _busy = false;
  String? _actionError;

  @override
  void initState() {
    super.initState();
    _leaveGuardDisposer = ref.read(leaveDecisionProvider).register(_leaveGuard);
  }

  @override
  void dispose() {
    _leaveGuardDisposer?.call();
    super.dispose();
  }

  bool _isPreProcessing(ScanStage? stage) =>
      stage == ScanStage.binFound ||
      stage == ScanStage.ready ||
      stage == ScanStage.itemDetected;

  @override
  Widget build(BuildContext context) {
    final sessionAsync = ref.watch(scanSessionWatchProvider(widget.sessionId));
    final session = sessionAsync.valueOrNull;
    return PopScope(
      canPop: !_isPreProcessing(session?.stage),
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        unawaited(_handleLeaveRequest());
      },
      child: sessionAsync.when(
        loading: () => _page(
          context,
          title: 'Scan session',
          child: const _CenteredSpinner(),
        ),
        error: (error, _) =>
            _recovery(context, message: scanFailureCopy(error)),
        data: (session) => session == null
            ? _recovery(context, message: AppCopy.scanSessionMissing)
            : _sessionPage(context, session),
      ),
    );
  }

  AppPage _page(
    BuildContext context, {
    required String title,
    required Widget child,
  }) => AppPage(
    header: AppPageHeader(
      eyebrow: AppCopy.scanSessionEyebrow,
      title: title,
      onBack: () => unawaited(_handleLeaveRequest()),
    ),
    child: child,
  );

  Widget _recovery(BuildContext context, {required String message}) => _page(
    context,
    title: 'Scan session',
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const AppIcon('alert', size: 42, color: AppColors.amberText),
        const SizedBox(height: 12),
        Text(
          message,
          textAlign: TextAlign.center,
          style: AppTypography.body.copyWith(color: AppColors.muted),
        ),
        const SizedBox(height: 20),
        AppButton(
          label: AppCopy.retry,
          onPressed: () =>
              ref.invalidate(scanSessionWatchProvider(widget.sessionId)),
          expand: true,
        ),
        const SizedBox(height: 8),
        AppButton(
          label: 'Back to scanner',
          variant: AppButtonVariant.ghost,
          onPressed: () => context.go(AppRoutes.scan),
          expand: true,
        ),
      ],
    ),
  );

  Widget _sessionPage(BuildContext context, DepositSession session) {
    _sync(session);
    final instructionsAsync = ref.watch(scanInstructionsProvider);
    final binAsync = ref.watch(scanBinWatchProvider(session.binId));
    final completion = ref.watch(scanCompletionProvider(session.id));
    final resultAsync = session.resultId == null
        ? null
        : ref.watch(scanResultWatchProvider(session.resultId!));
    final result = resultAsync?.valueOrNull;
    final instructions = instructionsAsync.valueOrNull;
    final bin = binAsync.valueOrNull;

    return _page(
      context,
      title: _stageTitle(instructions, session, result),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          binAsync.when(
            loading: () => const ScannerStage(
              child: SizedBox.square(
                dimension: 28,
                child: CircularProgressIndicator(color: Colors.white),
              ),
            ),
            error: (error, _) => _binError(context, error, session),
            data: (bin) => bin == null
                ? _binError(context, null, session)
                : ScanStageVisual(
                    stage: session.stage,
                    capacityPercent: bin.capacityPercent,
                    outcomeTone: _outcomeTone(result),
                  ),
          ),
          const SizedBox(height: 18),
          _flowInfo(context, session, bin, instructions, result, completion),
          const SizedBox(height: 18),
          ..._actions(context, session, completion),
        ],
      ),
    );
  }

  Widget _binError(
    BuildContext context,
    Object? error,
    DepositSession session,
  ) => Column(
    children: [
      ScannerStage(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const AppIcon('alert', size: 42, color: AppColors.amberText),
            const SizedBox(height: 8),
            Text(
              error == null
                  ? 'This smart bin is no longer available.'
                  : scanFailureCopy(error),
              textAlign: TextAlign.center,
              style: AppTypography.activityMetadata.copyWith(
                fontSize: 12,
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 12),
      AppButton(
        label: AppCopy.retry,
        onPressed: () => ref.invalidate(scanBinWatchProvider(session.binId)),
      ),
    ],
  );

  Widget _flowInfo(
    BuildContext context,
    DepositSession session,
    SmartBin? bin,
    ScanInstructions? instructions,
    DepositResult? result,
    ScanCompletionState completion,
  ) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Align(child: _badge(session, result)),
      const SizedBox(height: 9),
      if (session.stage == ScanStage.completed && result != null)
        DepositResultCard(result: result, instructions: instructions!)
      else ...[
        Text(
          _stageTitle(instructions, session, result),
          textAlign: TextAlign.center,
          style: AppTypography.sectionHeading,
        ),
        const SizedBox(height: 9),
        Text(
          _stageDescription(instructions, session, bin, completion),
          textAlign: TextAlign.center,
          style: AppTypography.body.copyWith(
            color: AppColors.muted,
            height: 1.55,
          ),
        ),
      ],
      if (session.stage == ScanStage.binFound)
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: bin == null
              ? const SizedBox(height: 60)
              : BinDetailsCard(bin: bin),
        ),
      if (session.stage == ScanStage.processing ||
          session.stage == ScanStage.completed)
        _timingNote(instructions),
      if (_actionError != null) ...[
        const SizedBox(height: 12),
        Text(
          _actionError!,
          textAlign: TextAlign.center,
          style: AppTypography.activityMetadata.copyWith(
            fontSize: 12,
            color: Theme.of(context).colorScheme.error,
          ),
        ),
      ],
    ],
  );

  Widget _badge(DepositSession session, DepositResult? result) {
    final (label, tone) = switch (session.stage) {
      ScanStage.processing => (AppCopy.processingBadge, AppBadgeTone.amber),
      ScanStage.completed => switch (result?.outcome) {
        DepositOutcome.processing => ('Processing', AppBadgeTone.amber),
        DepositOutcome.review => ('Review', AppBadgeTone.amber),
        DepositOutcome.empty => ('Empty', AppBadgeTone.gray),
        DepositOutcome.rejected => ('Rejected', AppBadgeTone.red),
        DepositOutcome.verified => ('Verified', AppBadgeTone.green),
        DepositOutcome.unknown || null => ('Unavailable', AppBadgeTone.gray),
      },
      _ => (session.binId, AppBadgeTone.gray),
    };
    return AppBadge(label: label, tone: tone);
  }

  Widget _timingNote(ScanInstructions? instructions) => Padding(
    padding: const EdgeInsets.only(top: 8),
    child: Text(
      instructions?.pointsTimingNotice ?? '',
      textAlign: TextAlign.center,
      style: AppTypography.activityMetadata.copyWith(
        fontSize: 11,
        height: 1.5,
        color: AppColors.muted,
      ),
    ),
  );

  List<Widget> _actions(
    BuildContext context,
    DepositSession session,
    ScanCompletionState completion,
  ) {
    switch (session.stage) {
      case ScanStage.binFound || ScanStage.ready || ScanStage.itemDetected:
        return [
          AppButton(
            label: _actionLabel(session.stage),
            onPressed: _busy ? null : () => unawaited(_advance(session)),
            isLoading: _busy,
            expand: true,
          ),
        ];
      case ScanStage.processing:
        if (completion.failed) {
          return [
            AppButton(
              label: 'Retry verification',
              onPressed: _busy
                  ? null
                  : () => unawaited(
                      ref
                          .read(scanCompletionProvider(session.id).notifier)
                          .run(session.id),
                    ),
              expand: true,
            ),
          ];
        }
        return const [];
      case ScanStage.completed:
        return [
          AppButton(
            label: 'Back to home',
            onPressed: () => unawaited(_backToHome()),
            expand: true,
          ),
        ];
      case ScanStage.cancelled:
        return const [];
    }
  }

  String _actionLabel(ScanStage stage) => switch (stage) {
    ScanStage.binFound => 'Confirm session',
    ScanStage.ready => 'I pressed the finish button',
    ScanStage.itemDetected => 'Continue',
    _ => 'Continue',
  };

  String _stageTitle(
    ScanInstructions? instructions,
    DepositSession session,
    DepositResult? result,
  ) {
    if (session.stage == ScanStage.completed && result != null) {
      return switch (result.outcome) {
        DepositOutcome.processing => 'Processing deposit',
        DepositOutcome.verified =>
          instructions?.verifiedTitle ?? 'Deposit verified',
        DepositOutcome.review =>
          instructions?.reviewTitle ?? 'Deposit sent for review',
        DepositOutcome.empty => 'No recyclable items detected',
        DepositOutcome.rejected =>
          instructions?.rejectedTitle ?? 'Deposit not eligible',
        DepositOutcome.unknown => 'Deposit outcome unavailable',
      };
    }
    return switch (session.stage) {
      ScanStage.binFound => instructions?.binFoundTitle ?? 'Smart bin found',
      ScanStage.ready => instructions?.readyTitle ?? 'Ready to recycle?',
      ScanStage.itemDetected =>
        instructions?.itemDetectedTitle ?? 'Items detected',
      ScanStage.processing =>
        instructions?.processingTitle ?? 'Identifying your items',
      ScanStage.completed => 'Deposit complete',
      ScanStage.cancelled => 'Scan cancelled',
    };
  }

  String _stageDescription(
    ScanInstructions? instructions,
    DepositSession session,
    SmartBin? bin,
    ScanCompletionState completion,
  ) => switch (session.stage) {
    ScanStage.binFound =>
      bin == null
          ? session.binId
          : '${bin.locationName} · ${bin.locationDetail}',
    ScanStage.ready =>
      instructions?.readyDescription ??
          'Insert your items, then press the red finish button.',
    ScanStage.itemDetected =>
      instructions?.itemDetectedDescription ??
          'We are checking your recyclable items.',
    ScanStage.processing =>
      completion.failed
          ? AppCopy.scanCompleteFailed
          : instructions?.processingDescription ??
                'This usually takes a few seconds.',
    _ => '',
  };

  ScanStageOutcomeTone _outcomeTone(DepositResult? result) =>
      switch (result?.outcome) {
        DepositOutcome.processing => ScanStageOutcomeTone.amber,
        DepositOutcome.verified => ScanStageOutcomeTone.green,
        DepositOutcome.review => ScanStageOutcomeTone.amber,
        DepositOutcome.empty => ScanStageOutcomeTone.neutral,
        DepositOutcome.rejected => ScanStageOutcomeTone.red,
        _ => ScanStageOutcomeTone.neutral,
      };

  /// Post-frame side effects, gated by screen visibility so an offstage
  /// branch (StatefulShellRoute IndexedStack) never navigates the router:
  /// - track the session so Scan can resume committed work
  /// - canonicalize stale URLs to the committed stage state
  /// - start completion exactly once through the app-scoped controller
  void _sync(DepositSession session) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final tracker = ref.read(activeScanSessionProvider.notifier);
      final visible = _isVisible(session);
      if (session.stage == ScanStage.cancelled ||
          (session.stage == ScanStage.completed && visible)) {
        tracker.clear();
      } else {
        tracker.track(session);
      }
      if (!visible) return;
      if (session.stage != widget.expectedStage) {
        context.go(_pathForStage(session));
        return;
      }
      final completion = ref.read(scanCompletionProvider(session.id));
      if (session.stage == ScanStage.processing &&
          !completion.running &&
          !completion.failed) {
        unawaited(
          ref.read(scanCompletionProvider(session.id).notifier).run(session.id),
        );
      }
    });
  }

  /// The screen instance is visible when the router URI still points at the
  /// stage route this instance was built for.
  bool _isVisible(DepositSession session) {
    final ownPath = switch (widget.expectedStage) {
      ScanStage.binFound => AppRoutes.scanBinPath(widget.sessionId),
      ScanStage.ready => AppRoutes.scanReadyPath(widget.sessionId),
      ScanStage.itemDetected => AppRoutes.scanDetectedPath(widget.sessionId),
      ScanStage.processing => AppRoutes.scanProcessingPath(widget.sessionId),
      ScanStage.completed => AppRoutes.scanResultPath(widget.sessionId),
      ScanStage.cancelled => AppRoutes.scan,
    };
    return GoRouter.of(context).routeInformationProvider.value.uri.path ==
        ownPath;
  }

  String _pathForStage(DepositSession session) => switch (session.stage) {
    ScanStage.binFound => AppRoutes.scanBinPath(session.id),
    ScanStage.ready => AppRoutes.scanReadyPath(session.id),
    ScanStage.itemDetected => AppRoutes.scanDetectedPath(session.id),
    ScanStage.processing => AppRoutes.scanProcessingPath(session.id),
    ScanStage.completed => AppRoutes.scanResultPath(session.id),
    ScanStage.cancelled => AppRoutes.scan,
  };

  Future<void> _advance(DepositSession session) async {
    setState(() {
      _busy = true;
      _actionError = null;
    });
    try {
      final repository = ref.read(scanRepositoryProvider);
      switch (session.stage) {
        case ScanStage.binFound:
          await repository.confirmSession(session.id);
        case ScanStage.ready:
          await repository.reportFinishPressed(session.id);
        case ScanStage.itemDetected:
          await repository.startVerification(session.id);
        default:
          break;
      }
      // The session stream emits the new stage; canonicalization navigates.
    } on Object catch (error) {
      if (mounted) setState(() => _actionError = scanFailureCopy(error));
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  /// Guard registered with the shared navigation coordinator for branch
  /// changes, and reused for the top Back and system/browser Back controls.
  Future<LeaveDecision> _leaveGuard() async {
    final session = ref
        .read(scanSessionWatchProvider(widget.sessionId))
        .valueOrNull;
    if (session == null || !_isPreProcessing(session.stage)) {
      return LeaveDecision.leave;
    }
    return _confirmLeave();
  }

  Future<void> _handleLeaveRequest() async {
    final session = ref
        .read(scanSessionWatchProvider(widget.sessionId))
        .valueOrNull;
    if (session == null || !_isPreProcessing(session.stage)) {
      if (session?.stage == ScanStage.processing ||
          session?.stage == ScanStage.completed) {
        await _backToHome();
      }
      return;
    }
    final decision = await _confirmLeave();
    if (!mounted || decision == LeaveDecision.stay) return;
    context.go(AppRoutes.scan);
  }

  /// Asks whether to cancel the session or continue. A failed cancellation
  /// write is caught and keeps the session usable.
  Future<LeaveDecision> _confirmLeave() async {
    final decision = await showDialog<LeaveDecision>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        title: Text(AppCopy.scanLeaveTitle),
        content: Text(AppCopy.scanLeaveBody),
        actions: [
          TextButton(
            onPressed: () =>
                Navigator.of(dialogContext).pop(LeaveDecision.stay),
            child: Text(AppCopy.scanContinueSession),
          ),
          TextButton(
            onPressed: () =>
                Navigator.of(dialogContext).pop(LeaveDecision.leave),
            child: Text(
              AppCopy.scanCancelSession,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
        ],
      ),
    );
    if (decision != LeaveDecision.leave) return LeaveDecision.stay;
    try {
      await ref.read(scanRepositoryProvider).cancelSession(widget.sessionId);
      ref.read(activeScanSessionProvider.notifier).clear();
      return LeaveDecision.leave;
    } on Object {
      if (mounted) setState(() => _actionError = AppCopy.scanCancelFailed);
      return LeaveDecision.stay;
    }
  }

  Future<void> _backToHome() async {
    ref.read(activeScanSessionProvider.notifier).clear();
    if (mounted) context.go(AppRoutes.home);
  }
}

class _CenteredSpinner extends StatelessWidget {
  const _CenteredSpinner();

  @override
  Widget build(BuildContext context) =>
      const Center(child: CircularProgressIndicator());
}
