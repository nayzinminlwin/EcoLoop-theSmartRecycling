import 'package:eco_loop/core/presentation/app_formatters.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_spacing.dart';
import 'package:eco_loop/features/wallet/domain/models/wallet_snapshot.dart';
import 'package:eco_loop/shared/widgets/app_card.dart';
import 'package:eco_loop/shared/widgets/app_icon.dart';
import 'package:eco_loop/shared/widgets/app_progress_bar.dart';
import 'package:flutter/material.dart';

class WalletSummaryCard extends StatelessWidget {
  const WalletSummaryCard({
    required this.wallet,
    required this.progress,
    required this.onBrowseRewards,
    super.key,
  });

  final WalletSnapshot wallet;
  final double progress;
  final VoidCallback onBrowseRewards;

  @override
  Widget build(BuildContext context) {
    final remaining = wallet.nextRewardCost == null
        ? null
        : wallet.nextRewardCost! - wallet.balance;
    return AppCard(
      variant: AppCardVariant.elevated,
      padding: const EdgeInsets.all(AppSpacing.xxl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Available EcoPoints',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
              const AppIcon('leaf', color: AppColors.primary, size: 32),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            AppFormatters.points(wallet.balance),
            style: Theme.of(context).textTheme.displaySmall,
          ),
          const SizedBox(height: AppSpacing.lg),
          Row(
            children: [
              Expanded(
                child: Text(
                  remaining == null
                      ? 'All current reward levels unlocked'
                      : '$remaining points to your next reward',
                  style: Theme.of(context).textTheme.labelMedium,
                ),
              ),
              Text(
                '${(progress * 100).round()}%',
                style: Theme.of(context).textTheme.labelMedium,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          AppProgressBar(value: progress, label: 'Reward progress'),
          const SizedBox(height: AppSpacing.lg),
          OutlinedButton.icon(
            onPressed: onBrowseRewards,
            icon: const AppIcon('gift', size: 18, color: AppColors.primary),
            label: const Text('Browse rewards'),
          ),
        ],
      ),
    );
  }
}
