import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

class AppPointsPill extends StatelessWidget {
  const AppPointsPill({required this.points, super.key, this.label = 'points'});

  final int points;
  final String label;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      color: AppColors.mint,
      borderRadius: BorderRadius.circular(999),
    ),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      child: Text(
        '$points $label',
        style: const TextStyle(
          color: AppColors.primaryDark,
          fontWeight: FontWeight.w700,
        ),
      ),
    ),
  );
}
