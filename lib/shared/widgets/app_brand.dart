import 'package:eco_loop/core/presentation/app_copy.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_radii.dart';
import 'package:eco_loop/core/theme/app_spacing.dart';
import 'package:eco_loop/core/theme/app_typography.dart';
import 'package:flutter/material.dart';

class AppLogo extends StatelessWidget {
  const AppLogo({super.key, this.size = 34, this.borderRadius = AppRadii.icon});

  final double size;
  final double borderRadius;

  @override
  Widget build(BuildContext context) => Semantics(
    image: true,
    label: AppCopy.appName,
    child: SizedBox(
      width: size,
      height: size,
      child: Image.asset(
        'assets/icon/ecoLoop_icon_transparent.png',
        width: size,
        height: size,
        fit: BoxFit.contain,
      ),
    ),
  );
}

class AppBrand extends StatelessWidget {
  const AppBrand({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      AppLogo(
        size: compact ? 32 : 42,
        borderRadius: compact ? AppRadii.button : AppRadii.icon,
      ),
      SizedBox(width: compact ? AppSpacing.sm : 10),
      Text.rich(
        TextSpan(
          text: 'EcoLoop ',
          children: [
            TextSpan(
              text: 'AI',
              style: TextStyle(color: AppColors.primary),
            ),
          ],
        ),
        style: compact
            ? AppTypography.sectionHeading.copyWith(
                fontSize: 15,
                letterSpacing: -0.3,
              )
            : AppTypography.sectionHeading.copyWith(
                fontWeight: FontWeight.w600,
              ),
        maxLines: 1,
        overflow: TextOverflow.visible,
        softWrap: false,
      ),
    ],
  );
}
