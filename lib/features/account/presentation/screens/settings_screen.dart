import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/shared/widgets/app_avatar.dart';
import 'package:eco_loop/shared/widgets/app_confirmation_dialog.dart';
import 'package:eco_loop/shared/widgets/app_error_view.dart';
import 'package:eco_loop/shared/widgets/app_loading_view.dart';
import 'package:eco_loop/shared/widgets/app_page.dart';
import 'package:eco_loop/shared/widgets/app_page_header.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_radii.dart';
import 'package:eco_loop/core/theme/app_spacing.dart';
import 'package:eco_loop/core/theme/app_typography.dart';
import 'package:eco_loop/features/account/presentation/controllers/demo_session_controller.dart';
import 'package:eco_loop/features/account/presentation/controllers/settings_controller.dart';
import 'package:eco_loop/features/account/presentation/widgets/settings_list_tile.dart';
import 'package:eco_loop/features/account/domain/models/resident_profile.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(settingsProfileProvider);
    final session = ref.watch(demoSessionControllerProvider);
    return AppPage(
      header: const AppPageHeader(title: 'Settings', eyebrow: 'ACCOUNT'),
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
              _ProfileCard(profile: value),
              const SizedBox(height: AppSpacing.lg),
              ClipRRect(
                borderRadius: BorderRadius.circular(AppRadii.card),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    border: Border.all(color: AppColors.border),
                    borderRadius: BorderRadius.circular(AppRadii.card),
                  ),
                  child: Column(
                    children: [
                      SettingsListTile(
                        title: 'Profile & personal details',
                        icon: Icons.person_outline,
                        onTap: () => context.push(AppRoutes.profile),
                      ),
                      const Divider(height: 1),
                      SettingsListTile(
                        title: 'Account security',
                        icon: Icons.lock_outline,
                        onTap: () => context.push(AppRoutes.security),
                      ),
                      const Divider(height: 1),
                      SettingsListTile(
                        title: 'Notifications',
                        icon: Icons.notifications_none,
                        onTap: () =>
                            context.push(AppRoutes.notificationPreferences),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              SizedBox(
                width: double.infinity,
                child: TextButton.icon(
                  onPressed: session.isLoading
                      ? null
                      : () => _signOut(context, ref),
                  icon: const Icon(Icons.logout, size: 18),
                  label: session.isLoading
                      ? const Text('Signing out...')
                      : const Text('Sign out'),
                ),
              ),
              if (session.hasError)
                Padding(
                  padding: const EdgeInsets.only(top: AppSpacing.sm),
                  child: Text(
                    'We could not sign you out. Please try again.',
                    style: TextStyle(color: AppColors.red),
                  ),
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

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({required this.profile});

  final ResidentProfile profile;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(AppSpacing.md),
    decoration: BoxDecoration(
      color: AppColors.surface,
      border: Border.all(color: AppColors.border),
      borderRadius: BorderRadius.circular(AppRadii.card),
    ),
    child: Row(
      children: [
        AppAvatar(initials: profile.initials, radius: 28),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(profile.fullName, style: AppTypography.sectionHeading),
              const SizedBox(height: 2),
              Text(profile.email, style: AppTypography.textTheme.bodySmall),
            ],
          ),
        ),
      ],
    ),
  );
}
