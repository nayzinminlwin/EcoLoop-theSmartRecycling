import 'package:eco_loop/core/presentation/app_formatters.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_radii.dart';
import 'package:eco_loop/core/theme/app_shadows.dart';
import 'package:eco_loop/core/theme/app_typography.dart';
import 'package:eco_loop/features/wallet/domain/models/wallet_snapshot.dart';

import '../controllers/home_controller.dart';

import 'package:eco_loop/shared/widgets/app_icon.dart';
import 'package:eco_loop/shared/widgets/app_progress_bar.dart';
import 'package:flutter/material.dart';

/// Green rounded wallet card with white number/copy, pale leaf orbit, amber
/// progress, and a white full-width Browse rewards action.
class WalletSummaryCard extends StatelessWidget {
  const WalletSummaryCard({
    required this.wallet,
    required this.progress,
    required this.progressState,
    required this.onBrowseRewards,
    super.key,
  });

  final WalletSnapshot wallet;
  final double progress;
  final RewardProgressState progressState;
  final VoidCallback onBrowseRewards;

  @override
  Widget build(BuildContext context) {
    final remaining = wallet.nextRewardCost == null
        ? null
        : wallet.nextRewardCost! - wallet.balance;
    final progressCopy = switch (progressState) {
      RewardProgressState.loading => 'Reward progress loading',
      RewardProgressState.error => 'Reward progress unavailable',
      RewardProgressState.noEligibleOffer => 'No eligible rewards available',
      RewardProgressState.allHigherLevelsUnlocked =>
        'All current reward levels unlocked',
      RewardProgressState.ready =>
        '${AppFormatters.points(remaining!)} points to your next reward',
    };
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.circular(AppRadii.prominent),
        boxShadow: AppShadows.main,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.prominent),
        child: Stack(
          children: [
            Positioned(
              right: -15,
              top: -20,
              child: Container(
                width: 130,
                height: 130,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white24),
                ),
                child: Center(
                  child: AppIcon('leaf', size: 34, color: AppColors.leafOrbit),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Available EcoPoints',
                    style: AppTypography.body.copyWith(
                      fontSize: 13,
                      color: AppColors.onPrimaryPale,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    AppFormatters.points(wallet.balance),
                    style: AppTypography.walletNumber.copyWith(
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          progressCopy,
                          style: AppTypography.activityMetadata.copyWith(
                            fontSize: 11,
                            color: AppColors.walletCardPole,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        '${(progress * 100).round()}%',
                        style: AppTypography.activityMetadata.copyWith(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  AppProgressBar(
                    value: progress,
                    height: 6,
                    label: 'Reward progress',
                    color: AppColors.amber,
                    trackColor: Colors.white24,
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(minHeight: 44),
                      child: Material(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(AppRadii.button),
                        clipBehavior: Clip.antiAlias,
                        child: InkWell(
                          onTap: onBrowseRewards,
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            child: Row(
                              children: [
                                Text(
                                  'Browse rewards',
                                  style: AppTypography.body.copyWith(
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.primary,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                const AppIcon(
                                  'arrow',
                                  size: 18,
                                  color: AppColors.primary,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
