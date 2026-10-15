import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

abstract final class AppTypography {
  static const fontFamily = 'Inter';
  static const textTheme = TextTheme(
    displaySmall: TextStyle(
      fontSize: 29,
      height: 1.15,
      letterSpacing: -1.16,
      fontWeight: FontWeight.w800,
    ),
    headlineMedium: TextStyle(
      fontSize: 25,
      height: 1.15,
      letterSpacing: -0.8,
      fontWeight: FontWeight.w800,
    ),
    titleLarge: TextStyle(
      fontSize: 19,
      letterSpacing: -0.38,
      fontWeight: FontWeight.w700,
    ),
    titleMedium: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
    bodyLarge: TextStyle(fontSize: 16, height: 1.4),
    bodyMedium: TextStyle(fontSize: 14, height: 1.4, color: AppColors.muted),
    labelLarge: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
    labelMedium: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
    labelSmall: TextStyle(
      fontSize: 11,
      fontWeight: FontWeight.w800,
      letterSpacing: 1.21,
    ),
  );
}
