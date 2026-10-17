import 'package:eco_loop/core/domain/material_type.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_radii.dart';
import 'package:eco_loop/core/theme/app_typography.dart';
import 'package:flutter/material.dart' hide MaterialType;

import '../../domain/models/smart_bin.dart';

/// Split accepts/capacity detail row for the bin-found stage
/// (source `.bin-details`: 1px line border, radius 13, two equal cells).
class BinDetailsCard extends StatelessWidget {
  const BinDetailsCard({required this.bin, super.key});

  final SmartBin bin;

  @override
  Widget build(BuildContext context) => Container(
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
            child: _cell(
              context,
              label: 'Accepts',
              value: bin.acceptedMaterials.map(_materialLabel).join(' · '),
            ),
          ),
          Container(width: 1, color: AppColors.border),
          Expanded(
            child: _cell(
              context,
              label: 'Capacity',
              value: '${bin.capacityPercent}% · ${_capacityLabel()}',
              valueColor: _capacityColor(),
            ),
          ),
        ],
      ),
    ),
  );

  String _materialLabel(MaterialType type) => switch (type) {
    MaterialType.plastic => 'Plastic',
    MaterialType.aluminium => 'Cans',
    MaterialType.paper => 'Paper',
    MaterialType.glass => 'Glass',
    MaterialType.unknown => 'Mixed',
  };

  String _capacityLabel() => switch (bin.capacityPercent) {
    >= 80 => 'Critical',
    >= 60 => 'Warning',
    _ => 'Normal',
  };

  Color _capacityColor() => switch (bin.capacityPercent) {
    >= 80 => AppColors.redText,
    >= 60 => AppColors.amberText,
    _ => AppColors.primary,
  };

  Widget _cell(
    BuildContext context, {
    required String label,
    required String value,
    Color? valueColor,
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
            color: valueColor ?? AppColors.text,
          ),
        ),
      ],
    ),
  );
}
