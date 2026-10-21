import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/shared/widgets/app_card.dart';
import 'package:eco_loop/shared/widgets/app_icon.dart';
import 'package:eco_loop/shared/widgets/app_button.dart';
import 'package:flutter/material.dart';

import '../../domain/models/reward.dart';

class RewardCard extends StatelessWidget {
  const RewardCard({
    required this.reward,
    required this.balance,
    required this.onRedeem,
    super.key,
  });

  final Reward reward;
  final int balance;
  final VoidCallback onRedeem;

  @override
  Widget build(BuildContext context) {
    final atLimit =
        reward.residentRedemptionCount >= reward.maxRedemptionsPerResident;
    final canRedeem = balance >= reward.pointsCost && !atLimit;
    final art = switch (reward.artKey) {
      'cafe' => (AppColors.amberBackground, AppColors.amberText),
      'meal' => (const Color(0xFFF1E8DD), const Color(0xFF8A6044)),
      'shopping' => (const Color(0xFFE5EEF1), AppColors.blue),
      _ => (AppColors.sage, AppColors.primary),
    };
    return AppCard(
      padding: const EdgeInsets.all(12),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 214),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              height: 72,
              width: double.infinity,
              decoration: BoxDecoration(
                color: art.$1,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Stack(
                children: [
                  Center(
                    child: AppIcon(
                      'gift',
                      size: 34,
                      color: art.$2,
                      semanticLabel: 'Gift reward',
                    ),
                  ),
                  if (reward.tag != null)
                    Positioned(
                      left: 6,
                      top: 6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 7,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: .82),
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: Text(
                          reward.tag!,
                          style: Theme.of(context).textTheme.labelSmall,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Text(
              reward.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: 3),
            Text(
              reward.merchantName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall,
            ),
            Text(
              '${reward.pointsCost} points',
              style: const TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 32),
            AppButton(
              label: atLimit
                  ? 'Redeemed'
                  : balance < reward.pointsCost
                  ? 'Not enough points'
                  : 'Redeem',
              onPressed: canRedeem ? onRedeem : null,
              expand: true,
            ),
          ],
        ),
      ),
    );
  }
}
