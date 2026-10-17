import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/core/data/app_failure.dart';
import 'package:eco_loop/core/presentation/app_copy.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/models/deposit_result.dart';
import '../../domain/models/deposit_session.dart';
import '../../domain/models/scan_instructions.dart';
import '../../domain/models/smart_bin.dart';

final scanInstructionsProvider = FutureProvider<ScanInstructions>(
  (ref) => ref.watch(scanRepositoryProvider).getInstructions(),
);

/// Live session observation by ID. A session link for unknown work resolves
/// to `null` so the screen can offer recovery instead of spinning forever.
final scanSessionWatchProvider = StreamProvider.family<DepositSession?, String>(
  (ref, sessionId) => ref.watch(scanRepositoryProvider).watchSession(sessionId),
);

final scanBinWatchProvider = StreamProvider.family<SmartBin?, String>(
  (ref, binId) => ref.watch(scanRepositoryProvider).watchBin(binId),
);

/// Result observation. Screens subscribe only after the session exposes a
/// `resultId`; unknown IDs resolve to `null` until the result commits.
final scanResultWatchProvider = StreamProvider.family<DepositResult?, String>(
  (ref, resultId) => ref.watch(scanRepositoryProvider).watchResult(resultId),
);

/// The unfinished scan session the resident should resume, tracked from
/// session/controller state instead of the current route string.
class ActiveScanSession {
  const ActiveScanSession({required this.sessionId, required this.stage});

  final String sessionId;
  final ScanStage stage;

  bool get isUnfinished =>
      stage != ScanStage.completed && stage != ScanStage.cancelled;

  /// Anything except a cancelled session resumes the branch's committed
  /// route, so leaving during processing and returning shows the result.
  bool get shouldResume => stage != ScanStage.cancelled;
}

class ActiveScanSessionController extends Notifier<ActiveScanSession?> {
  @override
  ActiveScanSession? build() => null;

  void track(DepositSession session) =>
      state = ActiveScanSession(sessionId: session.id, stage: session.stage);

  void clear() => state = null;
}

final activeScanSessionProvider =
    NotifierProvider<ActiveScanSessionController, ActiveScanSession?>(
      ActiveScanSessionController.new,
    );

/// Verification completion lives at app scope: leaving the processing screen
/// never cancels it, and a failure stays retryable without a new session.
class ScanCompletionState {
  const ScanCompletionState({this.running = false, this.retryable = false});

  final bool running;
  final bool retryable;

  bool get failed => !running && retryable;
}

class ScanCompletionController
    extends FamilyNotifier<ScanCompletionState, String> {
  @override
  ScanCompletionState build(String arg) => const ScanCompletionState();

  Future<void> run(String sessionId) async {
    if (state.running) return;
    state = const ScanCompletionState(running: true);
    try {
      await ref.read(scanRepositoryProvider).completeVerification(sessionId);
      state = const ScanCompletionState();
    } on AppFailure catch (failure) {
      state = ScanCompletionState(retryable: failure.retryable);
    } catch (_) {
      state = const ScanCompletionState(retryable: true);
    }
  }
}

final scanCompletionProvider =
    NotifierProvider.family<
      ScanCompletionController,
      ScanCompletionState,
      String
    >(ScanCompletionController.new);

/// Maps repository failure identities to resident-facing copy.
String scanFailureCopy(Object error) {
  final messageKey = error is AppFailure ? error.messageKey : '';
  return switch (messageKey) {
    'scan.invalidQr' => 'That QR code is not a valid EcoLoop bin.',
    'scan.binFull' => 'This bin is full right now. Please try another bin.',
    'scan.binOffline' => 'This bin is offline. Please try again later.',
    'scan.invalidTransition' =>
      'That action is not available for the current session.',
    'scan.cannotCancel' =>
      'The deposit is already being verified and cannot be cancelled.',
    'mock.session.notFound' => 'This scan session is no longer available.',
    'mock.bin.notFound' => 'This smart bin is no longer available.',
    'mock.result.notFound' => 'This deposit result is no longer available.',
    _ => AppCopy.scanUnavailable,
  };
}
