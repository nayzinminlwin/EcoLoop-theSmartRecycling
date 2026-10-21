import 'package:eco_loop/core/data/exit_intent.dart';
import 'package:eco_loop/core/data/exit_intent_coordinator.dart';
import 'package:eco_loop/core/data/exit_intent_store.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'coalesces duplicate active exit intents and persists immutable identity',
    () async {
      final preferences = MemoryPreferences();
      final coordinator = ExitIntentCoordinator(
        store: ExitIntentStore(preferences: preferences),
        idFactory: () => 'exit-1',
        now: () => DateTime.utc(2026, 1, 1),
      );

      final first = coordinator.enqueue(
        operation: ExitIntentOperation.cancelSession,
        targetIdentity: 'session-1',
        owner: 'resident-1',
        installationId: 'install-1',
        authGeneration: 'auth-1',
        registrationGeneration: 'registration-1',
      );
      final duplicate = coordinator.enqueue(
        operation: ExitIntentOperation.cancelSession,
        targetIdentity: 'session-1',
        owner: 'resident-1',
        installationId: 'install-1',
        authGeneration: 'auth-2',
        registrationGeneration: 'registration-2',
      );

      expect(duplicate.id, first.id);
      expect(coordinator.intents, hasLength(1));
      await Future<void>.delayed(Duration.zero);

      final restored = ExitIntentCoordinator(
        store: ExitIntentStore(preferences: preferences),
      );
      await restored.restore();
      expect(restored.intents.single.id, 'exit-1');
      expect(restored.intents.single.authGeneration, 'auth-1');
      expect(restored.intents.single.state, ExitIntentState.locallyExited);
    },
  );

  test(
    'tracks delivery, retry and server resolution without changing identity',
    () {
      final coordinator = ExitIntentCoordinator(
        store: ExitIntentStore(preferences: MemoryPreferences()),
        idFactory: () => 'exit-1',
        now: () => DateTime.utc(2026, 1, 1),
      );
      final intent = coordinator.enqueue(
        operation: ExitIntentOperation.signOut,
        targetIdentity: 'resident-1',
        owner: 'resident-1',
        installationId: 'install-1',
        authGeneration: 'auth-1',
        registrationGeneration: 'registration-1',
      );

      coordinator.markAwaitingDelivery(intent.id);
      coordinator.markRetryWait(intent.id, DateTime.utc(2026, 1, 1, 0, 1));
      expect(
        coordinator.retryDue(DateTime.utc(2026, 1, 1, 0, 1)),
        hasLength(1),
      );
      coordinator.markAccepted(intent.id, 'server-acceptance-1');
      coordinator.markResolved(intent.id, reference: 'server-completion-1');

      final resolved = coordinator.intents.single;
      expect(resolved.id, intent.id);
      expect(resolved.attemptCount, 1);
      expect(resolved.serverAcceptanceReference, 'server-acceptance-1');
      expect(resolved.serverCompletionReference, 'server-completion-1');
      expect(resolved.isTerminal, isTrue);
    },
  );

  test(
    'restores the local signed-out fence independently of SDK state',
    () async {
      final preferences = MemoryPreferences();
      final store = ExitIntentStore(preferences: preferences);
      final coordinator = ExitIntentCoordinator(store: store);

      coordinator.fenceSignedOut();
      await Future<void>.delayed(Duration.zero);

      final restored = ExitIntentCoordinator(store: store);
      await restored.restore();
      expect(restored.isLocallySignedOut, isTrue);

      restored.clearSignedOutFence();
      await Future<void>.delayed(Duration.zero);
      final cleared = ExitIntentCoordinator(store: store);
      await cleared.restore();
      expect(cleared.isLocallySignedOut, isFalse);
    },
  );
}

class MemoryPreferences implements ExitIntentPreferences {
  final values = <String, String>{};

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> remove(String key) async => values.remove(key);

  @override
  Future<void> write(String key, String value) async {
    values[key] = value;
  }
}
