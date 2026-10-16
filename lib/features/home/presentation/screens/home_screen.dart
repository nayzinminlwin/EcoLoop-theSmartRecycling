import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/core/presentation/app_copy.dart';
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
    return AppPage(
      child: state.when(
        loading: () => const SizedBox(
          height: 500,
          child: AppLoadingView(message: 'Loading your dashboard'),
        ),
        error: (_, _) => AppErrorView(
          message: AppCopy.loadDashboardFailed,
          onRetry: () => ref.read(homeControllerProvider.notifier).refresh(),
        ),
        data: (data) => _HomeContent(data: data),
      ),
    );
  }
}

class _HomeContent extends StatelessWidget {
  const _HomeContent({required this.data});
  final HomeViewData data;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      HomeGreeting(
        name: data.profile.firstName,
        initials: data.profile.initials,
      ),
      const SizedBox(height: 24),
      WalletSummaryCard(
        wallet: data.wallet,
        progress: data.rewardProgress,
        onBrowseRewards: () => context.go(AppRoutes.rewards),
      ),
      const SizedBox(height: 16),
      ScanCallToAction(onPressed: () => context.go(AppRoutes.scan)),
      const SizedBox(height: 16),
      ImpactSummaryCard(summary: data.summary),
      const SizedBox(height: 16),
      HomeQuickActions(
        onGuide: () => context.go(AppRoutes.guide),
        onHistory: () => context.go(AppRoutes.history),
      ),
      const SizedBox(height: 24),
      AppSectionHeader(
        title: 'Recent recycling',
        actionLabel: 'View all',
        onAction: () => context.go(AppRoutes.history),
      ),
      if (data.recentDeposits.isEmpty)
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 24),
          child: Text('No recycling activity yet.'),
        )
      else
        ...data.recentDeposits.map(
          (deposit) => DepositActivityTile(deposit: deposit),
        ),
    ],
  );
}
