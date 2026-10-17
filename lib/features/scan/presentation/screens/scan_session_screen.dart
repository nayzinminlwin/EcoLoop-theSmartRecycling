import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/core/presentation/app_copy.dart';
import 'package:eco_loop/shared/widgets/app_button.dart';
import 'package:eco_loop/shared/widgets/app_page.dart';

import '../controllers/scan_controller.dart';
import '../../domain/models/deposit_session.dart';
import '../widgets/bin_details_card.dart';
import '../widgets/bin_session_visual.dart';
import '../widgets/deposit_result_card.dart';

class ScanSessionScreen extends ConsumerStatefulWidget {
  const ScanSessionScreen({
    super.key,
    required this.sessionId,
    required this.expectedStage,
  });
  final String sessionId;
  final ScanStage expectedStage;
  @override
  ConsumerState<ScanSessionScreen> createState() => _ScanSessionScreenState();
}

class _ScanSessionScreenState extends ConsumerState<ScanSessionScreen> {
  bool _busy = false;
  String? _error;
  bool _completionStarted = false;

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(scanSessionProvider(widget.sessionId));
    return AppPage(
      child: state.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => TextButton(
          onPressed: () =>
              ref.invalidate(scanSessionProvider(widget.sessionId)),
          child: const Text('Session unavailable. Try again.'),
        ),
        data: (session) {
          _syncCanonicalRoute(session);
          return FutureBuilder(
            future: ref.read(scanRepositoryProvider).getBin(session.binId),
            builder: (context, binState) {
              if (!binState.hasData) {
                return const Center(child: CircularProgressIndicator());
              }
              return _content(session, binState.data!);
            },
          );
        },
      ),
    );
  }

  void _syncCanonicalRoute(DepositSession session) {
    if (session.stage == ScanStage.processing &&
        widget.expectedStage == ScanStage.processing &&
        !_completionStarted) {
      _completionStarted = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _complete(session.id);
      });
      return;
    }
    if (session.stage == widget.expectedStage) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.go(_pathForStage(session));
    });
  }

  String _pathForStage(DepositSession session) => switch (session.stage) {
    ScanStage.binFound => AppRoutes.scanBinPath(session.id),
    ScanStage.ready => AppRoutes.scanReadyPath(session.id),
    ScanStage.itemDetected => AppRoutes.scanDetectedPath(session.id),
    ScanStage.processing => AppRoutes.scanProcessingPath(session.id),
    ScanStage.completed => AppRoutes.scanResultPath(session.id),
    ScanStage.cancelled => AppRoutes.scan,
  };

  Widget _content(DepositSession session, dynamic bin) {
    final repository = ref.read(scanRepositoryProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          _title(session.stage),
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 16),
        BinSessionVisual(capacityPercent: bin.capacityPercent),
        const SizedBox(height: 16),
        if (session.stage == ScanStage.binFound) BinDetailsCard(bin: bin),
        if (session.stage == ScanStage.ready)
          const Text(
            'Insert recyclable items, then press the red finish button on the bin.',
          ),
        if (session.stage == ScanStage.itemDetected)
          const Text(
            'Items detected. Continue when you are ready to verify them.',
          ),
        if (session.stage == ScanStage.processing)
          const Text(
            'Verification is in progress. You can leave this screen safely.',
          ),
        if (session.stage == ScanStage.completed && session.resultId != null)
          FutureBuilder(
            future: repository.getResult(session.resultId!),
            builder: (context, resultState) => resultState.hasData
                ? DepositResultCard(result: resultState.data!)
                : const CircularProgressIndicator(),
          ),
        if (_error != null)
          Text(
            _error!,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        const SizedBox(height: 20),
        if (session.stage == ScanStage.processing && _error != null)
          AppButton(
            label: 'Retry verification',
            onPressed: _busy ? null : () => _complete(session.id),
          ),
        if (session.stage != ScanStage.processing &&
            session.stage != ScanStage.completed &&
            session.stage != ScanStage.cancelled)
          AppButton(
            label: _actionLabel(session.stage),
            onPressed: _busy ? null : () => _advance(session),
          ),
        if (session.stage != ScanStage.processing &&
            session.stage != ScanStage.completed &&
            session.stage != ScanStage.cancelled)
          TextButton(
            onPressed: _busy ? null : () => _cancel(session.id),
            child: const Text(AppCopy.cancel),
          ),
      ],
    );
  }

  String _title(ScanStage stage) => switch (stage) {
    ScanStage.binFound => 'Smart bin found',
    ScanStage.ready => 'Ready to recycle?',
    ScanStage.itemDetected => 'Items detected',
    ScanStage.processing => 'Identifying your items',
    ScanStage.completed => 'Deposit complete',
    ScanStage.cancelled => 'Scan cancelled',
  };

  String _actionLabel(ScanStage stage) => switch (stage) {
    ScanStage.binFound => 'Confirm bin',
    ScanStage.ready => 'Press finish',
    ScanStage.itemDetected => 'Start verification',
    _ => 'Continue',
  };

  Future<void> _advance(dynamic session) async {
    setState(() => _busy = true);
    try {
      final repository = ref.read(scanRepositoryProvider);
      final updated = switch (session.stage) {
        ScanStage.binFound => await repository.confirmSession(session.id),
        ScanStage.ready => await repository.reportFinishPressed(session.id),
        ScanStage.itemDetected => await repository.startVerification(
          session.id,
        ),
        _ => session,
      };
      if (!mounted) return;
      ref.invalidate(scanSessionProvider(widget.sessionId));
      if (updated.stage == ScanStage.processing) {
        context.go(AppRoutes.scanProcessingPath(updated.id));
      }
    } catch (_) {
      if (mounted) setState(() => _error = AppCopy.scanUnavailable);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _complete(String id) async {
    setState(() => _busy = true);
    try {
      await ref.read(scanRepositoryProvider).completeVerification(id);
      if (mounted) {
        ref.invalidate(scanSessionProvider(widget.sessionId));
        context.go(AppRoutes.scanResultPath(id));
      }
    } catch (_) {
      if (mounted) setState(() => _error = AppCopy.scanCompleteFailed);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel(String id) async {
    await ref.read(scanRepositoryProvider).cancelSession(id);
    if (mounted) context.go(AppRoutes.scan);
  }
}
