import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/providers/app_providers.dart';

final signOutControllerProvider =
    AsyncNotifierProvider.autoDispose<SignOutController, void>(
      SignOutController.new,
    );

class SignOutController extends AutoDisposeAsyncNotifier<void> {
  @override
  Future<void> build() async {}

  Future<bool> signOut() async {
    state = const AsyncLoading<void>();
    state = await AsyncValue.guard(
      () => ref.read(accountRepositoryProvider).signOut(),
    );
    return !state.hasError;
  }
}
