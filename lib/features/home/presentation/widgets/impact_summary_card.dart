import 'package:eco_loop/core/presentation/app_formatters.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_radii.dart';
import 'package:eco_loop/core/theme/app_typography.dart';
import 'package:eco_loop/features/activity/domain/models/recycling_summary.dart';
import 'package:flutter/material.dart';

/// Compact joined impact card with a center divider and an honest estimate
/// label for weight derived from accepted verified item counts.
class ImpactSummaryCard extends StatelessWidget {
  const ImpactSummaryCard({required this.summary, super.key});

  final RecyclingSummary summary;

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadii.card),
      border: Border.all(color: AppColors.border),
    ),
    child: IntrinsicHeight(
      child: Row(
        children: [
          Expanded(
            child: _Metric(
              value: '${summary.verifiedDepositCount}',
              label: 'Verified deposits',
            ),
          ),
          Container(width: 1, color: AppColors.border),
          Expanded(
            child: _Metric(
              value: AppFormatters.weight(summary.verifiedWeightKg),
              label: 'Estimated recycled',
            ),
          ),
        ],
      ),
    ),
  );
}

class _Metric extends StatelessWidget {
  const _Metric({required this.value, required this.label});
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          style: AppTypography.statValue.copyWith(color: AppColors.text),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: AppTypography.activityMetadata.copyWith(
            fontSize: 11,
            color: AppColors.muted,
          ),
        ),
      ],
    ),
  );
}
