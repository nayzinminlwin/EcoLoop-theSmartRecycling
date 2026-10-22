import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_spacing.dart';
import 'package:flutter/material.dart';

import '../../domain/models/recycling_step.dart';

class RecyclingStepsList extends StatelessWidget {
  const RecyclingStepsList({required this.steps, super.key});

  final List<RecyclingStep> steps;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      for (var index = 0; index < steps.length; index++)
        ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 32,
                  child: Column(
                    children: [
                      SizedBox.square(
                        dimension: 30,
                        child: CircleAvatar(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          child: Text('${steps[index].order}'),
                        ),
                      ),
                      if (index < steps.length - 1)
                        Expanded(
                          child: Container(
                            width: 1,
                            color: AppColors.onPrimaryPale,
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.lg),
                    child: Text(steps[index].instruction),
                  ),
                ),
              ],
            ),
          ),
        ),
    ],
  );
}
