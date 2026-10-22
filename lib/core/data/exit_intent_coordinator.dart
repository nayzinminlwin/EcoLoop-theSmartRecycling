import 'dart:async';
import 'dart:math';

import '../diagnostics/app_logger.dart';
import 'exit_intent.dart';
import 'exit_intent_store.dart';

class ExitIntentCoordinator {
  ExitIntentCoordinator({
    ExitIntentStore? store,
    AppLogger? logger,
    DateTime Function()? now,
    String Function()? idFactory,
    this.installationId = 'runtime',
  }) : _store = store ?? ExitIntentStore(),
       _logger = logger ?? AppLogger(),
       _now = now ?? DateTime.now,
       _idFactory = idFactory ?? _newId;

  final ExitIntentStore _store;
  final AppLogger _logger;
  final DateTime Function() _now;
  final String Function() _idFactory;
  final String installationId;
  final Map<String, ExitIntent> _intents = <String, ExitIntent>{};
  Future<void> _writeTail = Future<void>.value();
  bool _restored = false;
  bool _locallySignedOut = false;
  final Set<String> _abandonedSessions = <String>{};

  List<ExitIntent> get intents => List.unmodifiable(_intents.values);
  bool get isRestored => _restored;
  bool get isLocallySignedOut => _locallySignedOut;
  bool isSessionAbandoned(String sessionId) =>
      _abandonedSessions.contains(sessionId);

  void fenceSignedOut() {
    _locallySignedOut = true;
    _persistFence();
  }

  void clearSignedOutFence() {
    _locallySignedOut = false;
    _persistFence();
  }

  Future<void> restore() async {
    if (_restored) return;
    final restored = await _store.read();
    for (final intent in restored) {
      final current = _intents[intent.id];
      if (current == null || current.createdAt.isBefore(intent.createdAt)) {
        _intents[intent.id] = intent;
      }
    }
    _locallySignedOut =
        await _store.readFence() ||
        restored.any(
          (intent) =>
              intent.operation == ExitIntentOperation.signOut &&
              !intent.isTerminal,
        );
    _abandonedSessions.addAll(await _store.readAbandonedSessions());
    _restored = true;
  }

  ExitIntent enqueue({
    required ExitIntentOperation operation,
    required String targetIdentity,
    required String owner,
    required String installationId,
    required String authGeneration,
    required String registrationGeneration,
  }) {
    final existing = _intents.values.where(
      (intent) =>
          !intent.isTerminal &&
          intent.operation == operation &&
          intent.targetIdentity == targetIdentity &&
          intent.owner == owner &&
          intent.installationId == installationId,
    );
    if (existing.isNotEmpty) return existing.first;

    final intent = ExitIntent(
      id: _idFactory(),
      operation: operation,
      targetIdentity: targetIdentity,
      owner: owner,
      installationId: installationId,
      authGeneration: authGeneration,
      registrationGeneration: registrationGeneration,
      createdAt: _now().toUtc(),
      state: ExitIntentState.locallyExited,
      attemptCount: 0,
    );
    _intents[intent.id] = intent;
    _persist();
    return intent;
  }

  void markAwaitingDelivery(String id) => _update(id, (intent) {
    return intent.copyWith(
      state: ExitIntentState.awaitingDelivery,
      clearNextAttemptAt: true,
    );
  });

  void markAccepted(String id, String reference) => _update(id, (intent) {
    return intent.copyWith(
      state: ExitIntentState.accepted,
      serverAcceptanceReference: reference,
      clearNextAttemptAt: true,
    );
  });

  void markRetryWait(String id, DateTime nextAttemptAt) =>
      _update(id, (intent) {
        return intent.copyWith(
          state: ExitIntentState.retryWait,
          attemptCount: intent.attemptCount + 1,
          nextAttemptAt: nextAttemptAt.toUtc(),
        );
      });

  void markResolved(String id, {String? reference}) => _update(id, (intent) {
    return intent.copyWith(
      state: ExitIntentState.resolved,
      serverCompletionReference: reference,
      clearNextAttemptAt: true,
    );
  });

  void fenceSession(String sessionId) {
    _abandonedSessions.add(sessionId);
    _persistAbandonedSessions();
  }

  List<ExitIntent> retryDue([DateTime? at]) {
    final now = (at ?? _now()).toUtc();
    return intents
        .where(
          (intent) =>
              intent.state == ExitIntentState.retryWait &&
              intent.nextAttemptAt != null &&
              !intent.nextAttemptAt!.isAfter(now),
        )
        .toList(growable: false);
  }

  void _update(String id, ExitIntent Function(ExitIntent) update) {
    final current = _intents[id];
    if (current == null) {
      throw StateError('Unknown exit intent: $id');
    }
    _intents[id] = update(current);
    _persist();
  }

  void _persist() {
    _writeTail = _writeTail
        .then<void>((_) => _store.write(_intents.values))
        .catchError((Object error, StackTrace stackTrace) {
          _logger.error('exit_intent_persistence_failed', error);
          _logger.log(
            AppLogLevel.error,
            'exit_intent_persistence_stack',
            fields: <String, Object?>{'stack': stackTrace.toString()},
          );
        });
  }

  void _persistFence() {
    _writeTail = _writeTail
        .then<void>((_) => _store.writeFence(_locallySignedOut))
        .catchError((Object error, StackTrace stackTrace) {
          _logger.error('exit_fence_persistence_failed', error);
          _logger.log(
            AppLogLevel.error,
            'exit_fence_persistence_stack',
            fields: <String, Object?>{'stack': stackTrace.toString()},
          );
        });
  }

  void _persistAbandonedSessions() {
    _writeTail = _writeTail
        .then<void>((_) => _store.writeAbandonedSessions(_abandonedSessions))
        .catchError((Object error, StackTrace stackTrace) {
          _logger.error('abandoned_session_persistence_failed', error);
          _logger.log(
            AppLogLevel.error,
            'abandoned_session_persistence_stack',
            fields: <String, Object?>{'stack': stackTrace.toString()},
          );
        });
  }

  static String _newId() {
    final random = Random.secure();
    final suffix = List<String>.generate(
      24,
      (_) => random.nextInt(16).toRadixString(16),
    ).join();
    return 'exit_$suffix';
  }
}
