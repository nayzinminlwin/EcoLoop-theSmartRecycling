import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/shared/widgets/app_card.dart';
import 'package:flutter/material.dart';

import '../../domain/models/material_rate.dart';

class MaterialRatesTable extends StatelessWidget {
  const MaterialRatesTable({required this.rates, super.key});

  final List<MaterialRate> rates;

  @override
  Widget build(BuildContext context) => AppCard(
    padding: EdgeInsets.zero,
    child: Column(
      children: [
        _row(context, 'Material', 'Points / item', header: true),
        ...rates.map(
          (rate) => _row(
            context,
            rate.displayName,
            rate.eligible ? '${rate.pointsPerItem}' : 'Not accepted',
          ),
        ),
      ],
    ),
  );

  Widget _row(
    BuildContext context,
    String material,
    String points, {
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
        Text(points, style: Theme.of(context).textTheme.labelLarge),
      ],
    ),
  );
}
