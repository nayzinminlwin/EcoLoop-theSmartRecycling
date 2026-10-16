import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

import '../../domain/models/recycling_step.dart';

class RecyclingStepsList extends StatelessWidget {
  const RecyclingStepsList({required this.steps, super.key});

  final List<RecyclingStep> steps;

  @override
  Widget build(BuildContext context) => Column(
    children: steps
        .map(
          (step) => ListTile(
            contentPadding: EdgeInsets.zero,
            leading: CircleAvatar(
              radius: 15,
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              child: Text('${step.order}'),
            ),
            title: Text(step.instruction),
          ),
        )
        .toList(),
  );
}
