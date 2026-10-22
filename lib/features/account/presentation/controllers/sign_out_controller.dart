import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dart:async';

import '../../../../app/providers/app_providers.dart';
import '../../../../core/data/exit_intent.dart';
import '../../../../core/data/exit_intent_coordinator.dart';
import '../../domain/repositories/account_repository.dart';

final signOutControllerProvider =
    AsyncNotifierProvider.autoDispose<SignOutController, void>(
      SignOutController.new,
    );

class SignOutController extends AutoDisposeAsyncNotifier<void> {
  @override
  Future<void> build() async {}

  void signOut({required String owner}) {
    final coordinator = ref.read(exitIntentCoordinatorProvider);
    final intent = coordinator.enqueue(
      operation: ExitIntentOperation.signOut,
      targetIdentity: owner,
      owner: owner,
      installationId: coordinator.installationId,
      authGeneration: owner,
      registrationGeneration: owner,
    );
    coordinator.fenceSignedOut();
    final repository = ref.read(accountRepositoryProvider);
    unawaited(_cleanup(repository, coordinator, intent.id));
  }

  Future<void> _cleanup(
    AccountRepository repository,
    ExitIntentCoordinator coordinator,
    String intentId,
  ) async {
    try {
      await repository.signOut();
      coordinator.markResolved(intentId);
    } catch (error) {
      coordinator.markRetryWait(
        intentId,
        DateTime.now().toUtc().add(const Duration(seconds: 30)),
      );
    }
  }
}
