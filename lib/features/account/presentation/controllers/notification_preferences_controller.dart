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
    final previous = state;
    state = AsyncLoading<NotificationPreferences>().copyWithPrevious(previous);
    final next = await AsyncValue.guard(
      () => ref
          .read(accountRepositoryProvider)
          .updateNotificationPreferences(preferences),
    );
    state = next.hasError
        ? AsyncError<NotificationPreferences>(
            next.error!,
            next.stackTrace ?? StackTrace.current,
          ).copyWithPrevious(previous)
        : next;
  }
}
