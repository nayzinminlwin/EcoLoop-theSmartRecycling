import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/providers/app_providers.dart';
import '../../domain/models/demo_session.dart';

final demoSessionControllerProvider =
    AsyncNotifierProvider<DemoSessionController, DemoSession>(
      DemoSessionController.new,
    );

class DemoSessionController extends AsyncNotifier<DemoSession> {
  @override
  Future<DemoSession> build() =>
      ref.watch(accountRepositoryProvider).getDemoSession();

  Future<void> signOut() async {
    final previous = state;
    state = const AsyncLoading<DemoSession>().copyWithPrevious(previous);
    state = await AsyncValue.guard(() async {
      await ref.read(accountRepositoryProvider).signOut();
      final session = previous.value;
      if (session == null) {
        throw StateError('Demo session is unavailable after sign out.');
      }
      return session.copyWith(isSignedIn: false);
    });
  }

  Future<void> resume() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(accountRepositoryProvider).resumeDemoSession(),
    );
  }
}
