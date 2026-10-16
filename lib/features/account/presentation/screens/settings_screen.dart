import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/shared/widgets/app_avatar.dart';
import 'package:eco_loop/shared/widgets/app_confirmation_dialog.dart';
import 'package:eco_loop/shared/widgets/app_error_view.dart';
import 'package:eco_loop/shared/widgets/app_loading_view.dart';
import 'package:eco_loop/shared/widgets/app_page.dart';
import 'package:eco_loop/features/account/presentation/controllers/demo_session_controller.dart';
import 'package:eco_loop/features/account/presentation/controllers/settings_controller.dart';
import 'package:eco_loop/features/account/presentation/widgets/settings_list_tile.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(settingsProfileProvider);
    return AppPage(
      child: profile.when(
        loading: () => const AppLoadingView(message: 'Loading settings'),
        error: (_, _) => AppErrorView(
          message: 'We could not load your settings.',
          onRetry: () => ref.invalidate(settingsProfileProvider),
        ),
        data: (value) {
          if (value == null) {
            return const Text('Your profile is unavailable.');
          }
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Settings',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  AppAvatar(initials: value.initials, radius: 32),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          value.fullName,
                          style: const TextStyle(fontSize: 18),
                        ),
                        Text(value.email),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              SettingsListTile(
                title: 'Profile & personal details',
                subtitle: 'Name, email, and profile image',
                icon: Icons.person_outline,
                onTap: () => context.push(AppRoutes.profile),
              ),
              SettingsListTile(
                title: 'Account security',
                subtitle: 'Password and protection status',
                icon: Icons.lock_outline,
                onTap: () => context.push(AppRoutes.security),
              ),
              SettingsListTile(
                title: 'Notifications',
                subtitle: 'Choose the updates you receive',
                icon: Icons.notifications_none,
                onTap: () => context.push(AppRoutes.notificationPreferences),
              ),
              const SizedBox(height: 24),
              OutlinedButton.icon(
                onPressed: () => _signOut(context, ref),
                icon: const Icon(Icons.logout),
                label: const Text('Sign out'),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _signOut(BuildContext context, WidgetRef ref) async {
    final confirmed = await AppConfirmationDialog.show(
      context,
      title: 'Sign out of the demo?',
      body: 'Your saved demo data will remain available when you continue.',
      confirmLabel: 'Sign out',
    );
    if (confirmed != true || !context.mounted) return;
    await ref.read(demoSessionControllerProvider.notifier).signOut();
    if (context.mounted) context.go(AppRoutes.signedOut);
  }
}
