import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/providers/app_providers.dart';
import '../../domain/models/notification_preferences.dart';

final notificationPreferencesControllerProvider =
    AsyncNotifierProvider<
      NotificationPreferencesController,
      NotificationPreferences
    >(NotificationPreferencesController.new);

class NotificationPreferencesController
    extends AsyncNotifier<NotificationPreferences> {
  @override
  Future<NotificationPreferences> build() =>
      ref.watch(accountRepositoryProvider).getNotificationPreferences();

  Future<void> save(NotificationPreferences preferences) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref
          .read(accountRepositoryProvider)
          .updateNotificationPreferences(preferences),
    );
  }
}
