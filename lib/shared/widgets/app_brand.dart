import 'package:eco_loop/core/presentation/app_copy.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_radii.dart';
import 'package:eco_loop/core/theme/app_spacing.dart';
import 'package:eco_loop/core/theme/app_typography.dart';
import 'package:eco_loop/shared/widgets/app_icon.dart';
import 'package:flutter/material.dart';

class AppBrand extends StatelessWidget {
  const AppBrand({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: compact ? 28 : 34,
        height: compact ? 28 : 34,
        decoration: BoxDecoration(
          color: AppColors.primary,
          borderRadius: BorderRadius.circular(
            compact ? AppRadii.button : AppRadii.icon,
          ),
        ),
        child: Center(
          child: AppIcon(
            'leaf',
            size: compact ? 16 : 20,
            color: Colors.white,
            semanticLabel: AppCopy.appName,
          ),
        ),
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
