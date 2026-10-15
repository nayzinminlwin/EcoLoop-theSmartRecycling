import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_radii.dart';
import 'package:eco_loop/core/theme/app_shadows.dart';
import 'package:flutter/material.dart';

enum AppCardVariant { plain, bordered, elevated }

class AppCard extends StatelessWidget {
  const AppCard({
    required this.child,
    super.key,
    this.variant = AppCardVariant.bordered,
    this.padding,
    this.onTap,
  });

  final Widget child;
  final AppCardVariant variant;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      padding: padding ?? const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: variant == AppCardVariant.bordered
            ? Border.all(color: AppColors.border)
            : null,
        boxShadow: variant == AppCardVariant.elevated
            ? AppShadows.main
            : const [],
      ),
      child: child,
    );
    return onTap == null
        ? card
        : Semantics(
            button: true,
            child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(AppRadii.card),
              child: card,
            ),
          );
  }
}
