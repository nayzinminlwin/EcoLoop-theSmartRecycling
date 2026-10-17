import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/core/mock/app_clock.dart';
import 'package:eco_loop/core/presentation/app_copy.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_radii.dart';
import 'package:eco_loop/core/theme/app_spacing.dart';
import 'package:eco_loop/shared/widgets/app_error_view.dart';
import 'package:eco_loop/shared/widgets/app_loading_view.dart';
import 'package:eco_loop/shared/widgets/app_page.dart';
import 'package:eco_loop/shared/widgets/app_section_header.dart';
import 'package:eco_loop/features/home/presentation/controllers/home_controller.dart';
import 'package:eco_loop/features/home/presentation/widgets/home_greeting.dart';
import 'package:eco_loop/features/home/presentation/widgets/home_quick_actions.dart';
import 'package:eco_loop/features/home/presentation/widgets/impact_summary_card.dart';
import 'package:eco_loop/features/home/presentation/widgets/scan_call_to_action.dart';
import 'package:eco_loop/features/home/presentation/widgets/wallet_summary_card.dart';
import 'package:eco_loop/features/activity/presentation/widgets/deposit_activity_tile.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(homeControllerProvider);
    final clock = ref.watch(appClockProvider);
    return AppPage(
      child: state.when(
        loading: () => const SizedBox(
          height: 500,
          child: AppLoadingView(message: 'Loading your dashboard'),
        ),
        error: (_, _) => AppErrorView(
          message: AppCopy.loadDashboardFailed,
          onRetry: () => _refresh(context, ref),
        ),
        data: (data) => _HomeContent(data: data, clock: clock),
      ),
    );
  }

  Future<void> _refresh(BuildContext context, WidgetRef ref) async {
    try {
      await ref.read(homeControllerProvider.notifier).refresh();
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Dashboard could not be refreshed.')),
        );
      }
    }
  }
}

class _HomeContent extends StatelessWidget {
  const _HomeContent({required this.data, required this.clock});
  final HomeViewData data;
  final AppClock clock;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      HomeGreeting(
        name: data.profile.firstName,
        initials: data.profile.initials,
        clock: clock,
      ),
      const SizedBox(height: AppSpacing.section),
      WalletSummaryCard(
        wallet: data.wallet,
        progress: data.rewardProgress,
        onBrowseRewards: () => context.go(AppRoutes.rewards),
      ),
      const SizedBox(height: AppSpacing.section),
      ScanCallToAction(onPressed: () => context.go(AppRoutes.scan)),
      const SizedBox(height: AppSpacing.section),
      ImpactSummaryCard(summary: data.summary),
      const SizedBox(height: AppSpacing.section),
      HomeQuickActions(
        onGuide: () => context.go(AppRoutes.guide),
        onHistory: () => context.go(AppRoutes.history),
      ),
      const SizedBox(height: AppSpacing.section),
      AppSectionHeader(
        title: 'Recent recycling',
        eyebrow: 'ACTIVITY',
        actionLabel: 'View all',
        onAction: () => context.go(AppRoutes.history),
      ),
      const SizedBox(height: AppSpacing.md),
      if (data.recentDeposits.isEmpty)
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 24),
          child: Text('No recycling activity yet.'),
        )
      else
        DecoratedBox(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.border),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(AppRadii.card),
            child: Column(
              children: [
                for (
                  var index = 0;
                  index < data.recentDeposits.length;
                  index++
                ) ...[
                  if (index > 0) Container(height: 1, color: AppColors.border),
                  DepositActivityTile(
                    deposit: data.recentDeposits[index],
                    clock: clock,
                  ),
                ],
              ],
            ),
          ),
        ),
    ],
  );
}
