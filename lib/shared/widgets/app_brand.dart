import 'package:eco_loop/core/presentation/app_copy.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
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
      AppIcon('recycle', size: compact ? 24 : 30, color: AppColors.primary),
      SizedBox(width: compact ? AppSpacing.xs : AppSpacing.sm),
      Text(
        AppCopy.appName,
        style:
            (compact
                    ? AppTypography.textTheme.titleMedium
                    : AppTypography.textTheme.headlineSmall)
                ?.copyWith(fontWeight: FontWeight.w800),
      ),
    ],
  );
}
