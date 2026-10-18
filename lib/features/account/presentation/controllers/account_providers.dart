import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dart:async';

import '../../../../app/providers/app_providers.dart';
import '../../domain/models/auth_state.dart';
import '../../domain/models/account_security_info.dart';
import '../../domain/models/notification_preferences.dart';
import '../../domain/models/resident_profile.dart';

final residentUidProvider = StreamProvider.autoDispose<String?>((ref) async* {
  await for (final authState
      in ref.watch(accountRepositoryProvider).watchAuthState()) {
    yield authState.uid;
  }
});

final accountProfileProvider = StreamProvider.autoDispose<ResidentProfile?>((
  ref,
) {
  final repository = ref.watch(accountRepositoryProvider);
  return Stream.multi((multi) {
    StreamSubscription<ResidentProfile?>? profileSubscription;
    final authSubscription = repository.watchAuthState().listen((
      AuthState authState,
    ) {
      profileSubscription?.cancel();
      if (authState.uid == null) {
        multi.add(null);
        return;
      }
      profileSubscription = repository.watchProfile().listen(
        multi.add,
        onError: multi.addError,
      );
    }, onError: multi.addError);
    multi.onCancel = () async {
      await authSubscription.cancel();
      await profileSubscription?.cancel();
    };
  });
});

final securityInfoProvider = StreamProvider<AccountSecurityInfo?>(
  (ref) => ref.watch(accountRepositoryProvider).watchSecurityInfo(),
);

final notificationPreferencesProvider =
    StreamProvider<NotificationPreferences?>(
      (ref) =>
          ref.watch(accountRepositoryProvider).watchNotificationPreferences(),
    );
