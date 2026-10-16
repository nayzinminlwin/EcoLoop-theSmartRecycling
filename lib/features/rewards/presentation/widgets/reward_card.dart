import 'package:eco_loop/core/theme/app_colors.dart';
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
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              height: 96,
              width: double.infinity,
              decoration: BoxDecoration(
                color: AppColors.sage,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Stack(
                children: [
                  const Center(
                    child: Icon(
                      Icons.card_giftcard,
                      size: 40,
                      color: AppColors.primary,
                    ),
                  ),
                  if (reward.tag != null)
                    Positioned(
                      left: 8,
                      top: 8,
                      child: Chip(
                        label: Text(reward.tag!),
                        visualDensity: VisualDensity.compact,
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Text(reward.title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            Text(
              reward.description,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 10),
            Text(
              '${reward.pointsCost} points',
              style: const TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 10),
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
