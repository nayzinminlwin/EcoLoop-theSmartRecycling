import 'package:flutter/material.dart';
import 'package:eco_loop/core/theme/app_colors.dart';

class BinSessionVisual extends StatelessWidget {
  const BinSessionVisual({super.key, required this.capacityPercent});
  final int capacityPercent;

  @override
  Widget build(BuildContext context) => Container(
    height: 150,
    decoration: BoxDecoration(
      color: AppColors.sage,
      borderRadius: BorderRadius.circular(16),
    ),
    child: Center(
      child: Icon(
        Icons.delete_outline,
        size: 78,
        color: capacityPercent >= 80 ? AppColors.amberText : AppColors.primary,
      ),
    ),
  );
}
