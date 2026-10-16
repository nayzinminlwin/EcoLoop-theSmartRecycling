import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/shared/widgets/app_button.dart';
import 'package:eco_loop/shared/widgets/app_page.dart';
import 'package:eco_loop/shared/widgets/app_page_header.dart';
import 'package:eco_loop/shared/widgets/app_switch_tile.dart';
import 'package:eco_loop/features/account/domain/models/notification_preferences.dart';
import 'package:eco_loop/features/account/presentation/controllers/notification_preferences_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class NotificationPreferencesScreen extends ConsumerStatefulWidget {
  const NotificationPreferencesScreen({super.key});
  @override
  ConsumerState<NotificationPreferencesScreen> createState() =>
      _NotificationPreferencesScreenState();
}

class _NotificationPreferencesScreenState
    extends ConsumerState<NotificationPreferencesScreen> {
  bool? _recycling;
  bool? _points;
  bool? _rewards;
  String? _error;

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(notificationPreferencesControllerProvider);
    return AppPage(
      header: AppPageHeader(
        title: 'Notifications',
        onBack: () => context.go(AppRoutes.settings),
      ),
      child: state.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => Text(
          _error ?? 'Preferences are unavailable. Try again.',
          style: const TextStyle(color: Colors.red),
        ),
        data: (saved) {
          _recycling ??= saved.recyclingUpdates;
          _points ??= saved.pointsCredits;
          _rewards ??= saved.rewardReminders;
          return Column(
            children: [
              AppSwitchTile(
                title: 'Recycling updates',
                value: _recycling!,
                onChanged: (value) => setState(() => _recycling = value),
              ),
              AppSwitchTile(
                title: 'Points credits',
                value: _points!,
                onChanged: (value) => setState(() => _points = value),
              ),
              AppSwitchTile(
                title: 'Reward reminders',
                value: _rewards!,
                onChanged: (value) => setState(() => _rewards = value),
              ),
              const SizedBox(height: 24),
              AppButton(
                label: 'Save preferences',
                expand: true,
                isLoading: state.isLoading,
                onPressed: () => _save(saved),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(
                    _error!,
                    style: const TextStyle(color: Colors.red),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _save(NotificationPreferences saved) async {
    await ref
        .read(notificationPreferencesControllerProvider.notifier)
        .save(
          NotificationPreferences(
            residentId: saved.residentId,
            recyclingUpdates: _recycling!,
            pointsCredits: _points!,
            rewardReminders: _rewards!,
            updatedAt: saved.updatedAt,
          ),
        );
    if (!mounted) return;
    setState(() {
      _error = ref.read(notificationPreferencesControllerProvider).hasError
          ? 'Preferences could not be saved. Try again.'
          : null;
    });
  }
}
