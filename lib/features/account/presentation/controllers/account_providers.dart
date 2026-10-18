import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/providers/app_providers.dart';
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
) async* {
  final uid = await ref.watch(residentUidProvider.future);
  if (uid == null) {
    yield null;
    return;
  }
  yield* ref.watch(accountRepositoryProvider).watchProfile();
});

final securityInfoProvider = StreamProvider<AccountSecurityInfo?>(
  (ref) => ref.watch(accountRepositoryProvider).watchSecurityInfo(),
);

final notificationPreferencesProvider =
    StreamProvider<NotificationPreferences?>(
      (ref) =>
          ref.watch(accountRepositoryProvider).watchNotificationPreferences(),
    );
