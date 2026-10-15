import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

class AppProgressBar extends StatelessWidget {
  const AppProgressBar({
    required this.value,
    super.key,
    this.label,
    this.height = 8,
  });

  final double value;
  final String? label;
  final double height;

  @override
  Widget build(BuildContext context) {
    final progress = value.clamp(0.0, 1.0);
    return Semantics(
      label: label,
      value: '${(progress * 100).round()}%',
      child: ClipRRect(
        borderRadius: BorderRadius.circular(height),
        child: LinearProgressIndicator(
          value: progress,
          minHeight: height,
          backgroundColor: AppColors.sage,
          color: AppColors.primary,
        ),
      ),
    );
  }
}
