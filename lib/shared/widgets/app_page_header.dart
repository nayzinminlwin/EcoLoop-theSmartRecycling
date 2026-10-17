import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_radii.dart';
import 'package:eco_loop/core/theme/app_spacing.dart';
import 'package:eco_loop/core/theme/app_typography.dart';
import 'package:eco_loop/shared/widgets/app_icon.dart';
import 'package:flutter/material.dart';

/// In-content page title composition: bordered back control, eyebrow, and
/// page heading, matching the source `.page-title` row.
class AppPageHeader extends StatelessWidget {
  const AppPageHeader({
    required this.title,
    super.key,
    this.eyebrow,
    this.trailing,
    this.onBack,
  });

  final String title;
  final String? eyebrow;
  final Widget? trailing;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.center,
    children: [
      if (onBack != null) ...[
        SizedBox(
          width: 48,
          height: 48,
          child: InkWell(
            onTap: onBack,
            borderRadius: BorderRadius.circular(AppRadii.button),
            child: Center(
              child: Material(
                color: AppColors.surface,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadii.icon),
                  side: const BorderSide(color: AppColors.border),
                ),
                child: SizedBox(
                  width: 38,
                  height: 38,
                  child: RotatedBox(
                    quarterTurns: 2,
                    child: AppIcon('arrow', color: AppColors.text, size: 22),
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.md),
      ],
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (eyebrow != null)
              Text(
                eyebrow!,
                style: AppTypography.eyebrow.copyWith(color: AppColors.primary),
              ),
            if (eyebrow != null) const SizedBox(height: AppSpacing.xs),
            Text(
              title,
              style: AppTypography.pageHeading,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
      if (trailing != null) ?trailing,
    ],
  );
}
