import 'package:eco_loop/core/presentation/app_formatters.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/features/activity/domain/models/deposit_transaction.dart';
import 'package:eco_loop/shared/widgets/app_badge.dart';
import 'package:eco_loop/shared/widgets/app_icon.dart';
import 'package:flutter/material.dart';

class DepositActivityTile extends StatelessWidget {
  const DepositActivityTile({required this.deposit, super.key});

  final DepositTransaction deposit;

  @override
  Widget build(BuildContext context) {
    final (label, tone, points) = switch (deposit.status) {
      DepositStatus.verified => (
        'Verified',
        AppBadgeTone.green,
        '+${deposit.pointsAwarded ?? 0}',
      ),
      DepositStatus.review => ('Review', AppBadgeTone.amber, 'Pending'),
      DepositStatus.rejected => ('Rejected', AppBadgeTone.red, '0'),
      DepositStatus.unknown => ('Unknown', AppBadgeTone.gray, '0'),
    };
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: const CircleAvatar(
        backgroundColor: AppColors.mint,
        child: AppIcon('recycle', color: AppColors.primary, size: 20),
      ),
      title: Text(deposit.materialLabel),
      subtitle: Text(
        '${deposit.binId} · ${deposit.binLocation}\n${AppFormatters.dateTime(deposit.occurredAt)}',
      ),
      isThreeLine: true,
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(points, style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 4),
          AppBadge(label: label, tone: tone),
        ],
      ),
    );
  }
}
