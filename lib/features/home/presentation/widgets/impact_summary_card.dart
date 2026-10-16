import 'package:eco_loop/core/presentation/app_formatters.dart';
import 'package:eco_loop/core/theme/app_spacing.dart';
import 'package:eco_loop/features/activity/domain/models/recycling_summary.dart';
import 'package:eco_loop/shared/widgets/app_card.dart';
import 'package:flutter/material.dart';

class ImpactSummaryCard extends StatelessWidget {
  const ImpactSummaryCard({required this.summary, super.key});

  final RecyclingSummary summary;

  @override
  Widget build(BuildContext context) => AppCard(
    child: Row(
      children: [
        Expanded(
          child: _Metric(
            value: '${summary.verifiedDepositCount}',
            label: 'Verified deposits',
          ),
        ),
        const SizedBox(width: AppSpacing.lg),
        Expanded(
          child: _Metric(
            value: AppFormatters.weight(summary.verifiedWeightKg),
            label: 'Verified recycled',
          ),
        ),
      ],
    ),
  );
}

class _Metric extends StatelessWidget {
  const _Metric({required this.value, required this.label});
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(value, style: Theme.of(context).textTheme.headlineSmall),
      Text(label, style: Theme.of(context).textTheme.bodySmall),
    ],
  );
}
