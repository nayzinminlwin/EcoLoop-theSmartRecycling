import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/app/router/leave_decision_coordinator.dart';
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
  NotificationPreferences? _saved;
  VoidCallback? _removeLeaveGuard;

  bool get _dirty =>
      _saved != null &&
      (_recycling != _saved!.recyclingUpdates ||
          _points != _saved!.pointsCredits ||
          _rewards != _saved!.rewardReminders);

  @override
  void initState() {
    super.initState();
    _removeLeaveGuard = ref
        .read(leaveDecisionProvider)
        .register(
          () async => await _confirmDiscard()
              ? LeaveDecision.leave
              : LeaveDecision.stay,
        );
  }

  @override
  void dispose() {
    _removeLeaveGuard?.call();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(notificationPreferencesControllerProvider);
    final preferences = state.value;
    return PopScope(
      canPop: !_dirty,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _leaveToSettings();
      },
      child: AppPage(
        header: AppPageHeader(title: 'Notifications', onBack: _leaveToSettings),
        child: preferences == null
            ? state.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (_, _) => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _error ?? 'Preferences are unavailable.',
                      style: const TextStyle(color: Colors.red),
                    ),
                    TextButton(
                      onPressed: () => ref.invalidate(
                        notificationPreferencesControllerProvider,
                      ),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
                data: (_) => const SizedBox.shrink(),
              )
            : _form(preferences),
      ),
    );
  }

  Widget _form(NotificationPreferences saved) {
    _saved ??= saved;
    _recycling ??= saved.recyclingUpdates;
    _points ??= saved.pointsCredits;
    _rewards ??= saved.rewardReminders;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
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
        Row(
          children: [
            Expanded(
              child: AppButton(
                label: 'Cancel',
                variant: AppButtonVariant.secondary,
                onPressed: () => _cancel(saved),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: AppButton(
                label: 'Save',
                expand: true,
                isLoading: ref
                    .watch(notificationPreferencesControllerProvider)
                    .isLoading,
                onPressed: () => _save(saved),
              ),
            ),
          ],
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(_error!, style: const TextStyle(color: Colors.red)),
          ),
      ],
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
    final next = ref.read(notificationPreferencesControllerProvider);
    if (next.hasError || next.value == null) {
      setState(() => _error = 'Preferences could not be saved. Try again.');
      return;
    }
    setState(() {
      _saved = next.value;
      _recycling = next.value!.recyclingUpdates;
      _points = next.value!.pointsCredits;
      _rewards = next.value!.rewardReminders;
      _error = null;
    });
  }

  void _cancel(NotificationPreferences saved) => setState(() {
    _saved = saved;
    _recycling = saved.recyclingUpdates;
    _points = saved.pointsCredits;
    _rewards = saved.rewardReminders;
    _error = null;
  });

  Future<bool> _confirmDiscard() async {
    if (!_dirty || !mounted) return true;
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Discard preference changes?'),
        content: const Text('Your notification changes have not been saved.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep editing'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Discard'),
          ),
        ],
      ),
    );
    return result == true;
  }

  Future<void> _leaveToSettings() async {
    if (await _confirmDiscard() && mounted) context.go(AppRoutes.settings);
  }
}
