import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/shared/widgets/app_card.dart';
import 'package:flutter/material.dart';

import '../../domain/models/material_rate.dart';
import '../../domain/models/guide_rate_example.dart';

class MaterialRatesTable extends StatelessWidget {
  const MaterialRatesTable({
    required this.rates,
    required this.examples,
    super.key,
  });

  final List<MaterialRate> rates;
  final List<GuideRateExample> examples;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final compact =
          constraints.maxWidth < 360 ||
          MediaQuery.textScalerOf(context).scale(1) >= 1.35;
      return AppCard(
        padding: EdgeInsets.zero,
        child: compact
            ? Column(
                children: rates
                    .map((rate) => _compactRow(context, rate))
                    .toList(),
              )
            : Column(
                children: [
                  _row(
                    context,
                    'Material',
                    'Points / pc',
                    example: 'Example',
                    header: true,
                  ),
                  ...rates.map((rate) => _standardRow(context, rate)),
                ],
              ),
      );
    },
  );

  Widget _standardRow(BuildContext context, MaterialRate rate) {
    final count = _exampleCount(rate);
    return _row(
      context,
      rate.displayName,
      rate.eligible ? '${rate.pointsPerItem}' : 'Not accepted',
      example: count == null ? '—' : '$count pcs = ${rate.pointsFor(count)}',
    );
  }

  Widget _compactRow(BuildContext context, MaterialRate rate) {
    final count = _exampleCount(rate);
    final example = count == null
        ? '—'
        : '$count pcs = ${rate.pointsFor(count)}';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(rate.displayName, style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 6),
          Text(
            'Points / pc: ${rate.eligible ? rate.pointsPerItem : 'Not accepted'}',
          ),
          Text('Example: $example'),
        ],
      ),
    );
  }

  int? _exampleCount(MaterialRate rate) {
    final matches = examples.where(
      (item) => item.materialType == rate.materialType.wireValue,
    );
    return matches.isEmpty ? null : matches.first.itemCount;
  }

  Widget _row(
    BuildContext context,
    String material,
    String points, {
    String example = '',
    bool header = false,
  }) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    decoration: BoxDecoration(
      color: header ? AppColors.mint : null,
      border: const Border(bottom: BorderSide(color: AppColors.border)),
    ),
    child: Row(
      children: [
        Expanded(
          child: Text(
            material,
            style: header
                ? Theme.of(context).textTheme.labelLarge
                : Theme.of(context).textTheme.bodyMedium,
          ),
        ),
        SizedBox(
          width: 76,
          child: Text(
            points,
            textAlign: TextAlign.right,
            style: Theme.of(context).textTheme.labelLarge,
          ),
        ),
        SizedBox(
          width: 94,
          child: Text(
            example,
            textAlign: TextAlign.right,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ),
      ],
    ),
  );
}
