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
    state = const AsyncLoading();
    await ref.read(accountRepositoryProvider).signOut();
    state = await AsyncValue.guard(
      () => ref.read(accountRepositoryProvider).getDemoSession(),
    );
  }

  Future<void> resume() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(accountRepositoryProvider).resumeDemoSession(),
    );
  }
}
