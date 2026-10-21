import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_typography.dart';
import 'package:eco_loop/core/theme/eco_theme_extension.dart';
import 'package:flutter/material.dart';

enum AppBadgeTone { green, amber, red, gray }

class AppBadge extends StatelessWidget {
  const AppBadge({
    required this.label,
    super.key,
    this.tone = AppBadgeTone.green,
  });

  final String label;
  final AppBadgeTone tone;

  @override
  Widget build(BuildContext context) {
    final eco =
        Theme.of(context).extension<EcoThemeExtension>() ??
        const EcoThemeExtension();
    final (background, foreground) = switch (tone) {
      AppBadgeTone.green => (AppColors.mint, AppColors.primaryDark),
      AppBadgeTone.amber => (eco.amberBackground, eco.amberText),
      AppBadgeTone.red => (eco.redBackground, eco.redText),
      AppBadgeTone.gray => (eco.grayBackground, eco.grayText),
    };
    return Semantics(
      label: label,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: foreground,
              fontSize: AppTypography.badge.fontSize,
              fontWeight: AppTypography.badge.fontWeight,
            ),
          ),
        ),
      ),
    );
  }
}
