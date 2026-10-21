import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/shared/widgets/app_button.dart';
import 'package:flutter/material.dart';

import '../../domain/models/reward.dart';

class RewardRedemptionDialog extends StatelessWidget {
  const RewardRedemptionDialog({
    required this.reward,
    required this.balance,
    required this.onConfirm,
    this.error,
    this.isLoading = false,
    super.key,
  });

  final Reward reward;
  final int balance;
  final String? error;
  final bool isLoading;
  final VoidCallback onConfirm;

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Redeem reward?'),
    content: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(reward.title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 6),
        Text('${reward.pointsCost} points at ${reward.merchantName}.'),
        const SizedBox(height: 6),
        Text('Your balance: $balance points'),
        if (error != null) ...[
          const SizedBox(height: 12),
          Text(error!, style: const TextStyle(color: AppColors.redText)),
        ],
      ],
    ),
    actions: [
      Center(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextButton(
              onPressed: isLoading ? null : () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            const SizedBox(width: 8),
            AppButton(
              label: 'Confirm',
              onPressed: onConfirm,
              isLoading: isLoading,
              pendingLabel: 'Redeeming reward...',
            ),
          ],
        ),
      ),
    ],
  );
}
