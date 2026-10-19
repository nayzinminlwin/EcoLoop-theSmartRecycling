import 'package:eco_loop/core/presentation/app_copy.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_radii.dart';
import 'package:eco_loop/core/theme/app_typography.dart';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';

import '../../domain/models/deposit_result.dart';
import '../../domain/models/scan_instructions.dart';

/// Result-stage flow information: outcome badge, outcome-specific title and
/// copy, a structured count/material row, and the earned-points strip.
///
/// Only verified, credited results show the mint earned-points strip; review
///, empty, processing, and rejected outcomes keep their own copy and never
/// imply credit.
class DepositResultCard extends StatelessWidget {
  const DepositResultCard({
    required this.result,
    required this.instructions,
    super.key,
  });

  final DepositResult result;
  final ScanInstructions instructions;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(
        _title,
        textAlign: TextAlign.center,
        style: AppTypography.sectionHeading,
      ),
      const SizedBox(height: 4),
      Text(
        result.explanation,
        textAlign: TextAlign.center,
        style: AppTypography.body.copyWith(
          color: AppColors.muted,
          height: 1.55,
        ),
      ),
      const SizedBox(height: 6),
      _countMaterialRow(context),
      if (result.lines.length > 1) ...[
        const SizedBox(height: 10),
        _lineList(context),
      ],
      if (result.outcome == DepositOutcome.verified &&
          (result.pointsAwarded ?? 0) > 0) ...[
        const SizedBox(height: 8),
        _creditStrip(context),
      ],
      if (kDebugMode &&
          result.outcome == DepositOutcome.verified &&
          result.traceId != null) ...[
        const SizedBox(height: 8),
        SelectableText(
          'Reference: ${result.traceId}',
          textAlign: TextAlign.center,
          style: AppTypography.activityMetadata.copyWith(
            color: AppColors.muted,
          ),
        ),
      ],
    ],
  );

  String get _title => switch (result.outcome) {
    DepositOutcome.processing => 'Processing deposit',
    DepositOutcome.verified => instructions.verifiedTitle,
    DepositOutcome.review => instructions.reviewTitle,
    DepositOutcome.empty => 'No recyclable items detected',
    DepositOutcome.rejected => instructions.rejectedTitle,
    DepositOutcome.unknown => 'Deposit outcome unavailable',
  };

  Widget _countMaterialRow(BuildContext context) => Container(
    width: double.infinity,
    decoration: BoxDecoration(
      border: Border.all(color: AppColors.border),
      borderRadius: BorderRadius.circular(AppRadii.icon + 2),
    ),
    child: IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: _cell(context, label: 'Items', value: _countLabel),
          ),
          Container(width: 1, color: AppColors.border),
          Expanded(
            child: _cell(
              context,
              label: 'Material',
              value: result.materialLabel,
            ),
          ),
        ],
      ),
    ),
  );

  String get _countLabel {
    final total = result.totalDetectedObjectCount;
    if (result.outcome == DepositOutcome.empty) return '0 pcs';
    if (total == null) return 'Count pending review';
    return '$total pcs';
  }

  Widget _lineList(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text('Detected materials', style: AppTypography.activityTitle),
      const SizedBox(height: 6),
      for (final line in result.lines)
        Padding(
          padding: const EdgeInsets.only(bottom: 4),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  line.label + (line.eligible ? '' : ' · excluded'),
                  style: AppTypography.activityMetadata,
                ),
              ),
              Text(
                line.count == null ? 'Count pending' : '${line.count} pcs',
                style: AppTypography.activityMetadata,
              ),
            ],
          ),
        ),
    ],
  );

  Widget _creditStrip(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: AppColors.mint,
      borderRadius: BorderRadius.circular(AppRadii.icon + 2),
    ),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          AppCopy.ecoPointsEarned,
          style: AppTypography.body.copyWith(
            fontWeight: FontWeight.w600,
            color: AppColors.primary,
          ),
        ),
        Text(
          '+${result.pointsAwarded}',
          style: AppTypography.sectionHeading.copyWith(
            fontSize: 24,
            color: AppColors.primary,
          ),
        ),
      ],
    ),
  );

  Widget _cell(
    BuildContext context, {
    required String label,
    required String value,
  }) => Padding(
    padding: const EdgeInsets.all(12),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: AppTypography.activityMetadata.copyWith(
            fontSize: 11,
            color: AppColors.muted,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: AppTypography.activityMetadata.copyWith(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: AppColors.text,
          ),
        ),
      ],
    ),
  );
}
