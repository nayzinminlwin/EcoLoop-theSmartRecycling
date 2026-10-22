import 'package:eco_loop/core/domain/material_weight_constants.dart';
import 'package:eco_loop/core/mock/app_clock.dart';
import 'package:eco_loop/core/presentation/app_formatters.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_radii.dart';
import 'package:eco_loop/core/theme/app_typography.dart';
import 'package:eco_loop/features/activity/domain/models/deposit_transaction.dart';
import 'package:eco_loop/shared/widgets/app_badge.dart';
import 'package:flutter/material.dart';

/// Content-sized activity/history row: icon tile, flexible material/location/
/// date block, and a bounded points/status block that stacks at enlarged text
/// scales instead of overflowing.
class DepositActivityTile extends StatelessWidget {
  const DepositActivityTile({
    required this.deposit,
    super.key,
    this.clock,
    this.showWeight = false,
  });

  final DepositTransaction deposit;
  final AppClock? clock;
  final bool showWeight;

  @override
  Widget build(BuildContext context) {
    final (label, tone, points) = switch (deposit.status) {
      DepositStatus.processing => ('Processing', AppBadgeTone.amber, 'Pending'),
      DepositStatus.verified => (
        'Verified',
        AppBadgeTone.green,
        '+${AppFormatters.points(deposit.pointsAwarded ?? 0)}',
      ),
      DepositStatus.review => ('Review', AppBadgeTone.amber, 'Pending'),
      DepositStatus.excluded => ('Excluded', AppBadgeTone.gray, '0'),
      DepositStatus.empty => ('Empty', AppBadgeTone.gray, '0'),
      DepositStatus.rejected => ('Rejected', AppBadgeTone.red, '0'),
      DepositStatus.unknown => ('Unavailable', AppBadgeTone.gray, '0'),
    };
    final metadata = _metadata(context);

    return Padding(
      padding: const EdgeInsets.all(14),
      child: MediaQuery.textScalerOf(context).scale(14) > 14 * 1.3
          ? _stackedRow(context, metadata, points, label, tone)
          : _inlineRow(context, metadata, points, label, tone),
    );
  }

  List<String> _metadata(BuildContext context) {
    final lines = <String>[
      AppFormatters.location(deposit.binId, deposit.binLocation),
    ];
    if (clock == null) {
      lines.add(AppFormatters.dateTime(deposit.occurredAt));
      return lines;
    }
    final displayNow = clock!.toDisplay(clock!.now);
    final displayOccurred = clock!.toDisplay(deposit.occurredAt);
    var stamp = AppFormatters.activityStamp(displayOccurred, displayNow);
    if (showWeight) {
      final weightKg = deposit.lines.isEmpty
          ? MaterialWeightConstants.getWeightKg(
              deposit.materialType,
              deposit.acceptedItemCount,
            )
          : deposit.lines.fold<double>(
              0,
              (sum, line) =>
                  sum +
                  MaterialWeightConstants.getWeightKg(
                    line.materialType,
                    line.acceptedCount,
                  ),
            );
      stamp = '$stamp · ${AppFormatters.weight(weightKg)}';
    }
    lines.add(stamp);
    return lines;
  }

  Widget _iconTile() => Container(
    width: 38,
    height: 38,
    decoration: BoxDecoration(
      color: AppColors.mint,
      borderRadius: BorderRadius.circular(AppRadii.icon),
    ),
    child: Center(
      child: Image.asset(
        'assets/icons/recycle-symbol.png',
        width: 20,
        height: 20,
      ),
    ),
  );

  Widget _textBlock(List<String> metadata) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    mainAxisSize: MainAxisSize.min,
    children: [
      Text(
        _materialTitle,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: AppTypography.activityTitle.copyWith(color: AppColors.text),
      ),
      const SizedBox(height: 2),
      for (final line in metadata)
        Text(
          line,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: AppTypography.activityMetadata.copyWith(
            color: AppColors.muted,
          ),
        ),
    ],
  );

  String get _materialTitle => deposit.lines.isEmpty
      ? deposit.materialLabel
      : deposit.lines.map((line) => line.label).toSet().join(' · ');

  Widget _amountBlock(
    BuildContext context,
    String points,
    String label,
    AppBadgeTone tone,
  ) => Column(
    crossAxisAlignment: CrossAxisAlignment.end,
    mainAxisSize: MainAxisSize.min,
    children: [
      Text(
        points,
        style: AppTypography.activityTitle.copyWith(color: AppColors.primary),
      ),
      const SizedBox(height: 4),
      AppBadge(label: label, tone: tone),
    ],
  );

  Widget _inlineRow(
    BuildContext context,
    List<String> metadata,
    String points,
    String label,
    AppBadgeTone tone,
  ) => Row(
    crossAxisAlignment: CrossAxisAlignment.center,
    children: [
      _iconTile(),
      const SizedBox(width: 12),
      Expanded(child: _textBlock(metadata)),
      const SizedBox(width: 12),
      _amountBlock(context, points, label, tone),
    ],
  );

  Widget _stackedRow(
    BuildContext context,
    List<String> metadata,
    String points,
    String label,
    AppBadgeTone tone,
  ) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _iconTile(),
          const SizedBox(width: 12),
          Expanded(child: _textBlock(metadata)),
        ],
      ),
      const SizedBox(height: 8),
      Align(
        alignment: Alignment.centerRight,
        child: _amountBlock(context, points, label, tone),
      ),
    ],
  );
}
