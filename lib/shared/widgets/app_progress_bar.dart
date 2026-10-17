import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

class AppProgressBar extends StatelessWidget {
  const AppProgressBar({
    required this.value,
    super.key,
    this.label,
    this.height = 8,
    this.color,
    this.trackColor,
  });

  final double value;
  final String? label;
  final double height;
  final Color? color;
  final Color? trackColor;

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
          backgroundColor: trackColor ?? AppColors.sage,
          color: color ?? AppColors.primary,
        ),
      ),
    );
  }
}
