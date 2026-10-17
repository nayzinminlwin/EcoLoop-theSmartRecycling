import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_typography.dart';
import 'package:flutter/material.dart';

class AppSectionHeader extends StatelessWidget {
  const AppSectionHeader({
    required this.title,
    super.key,
    this.eyebrow,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? eyebrow;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.end,
    children: [
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (eyebrow != null)
              Text(
                eyebrow!,
                style: AppTypography.eyebrow.copyWith(color: AppColors.primary),
              ),
            if (eyebrow != null) const SizedBox(height: 4),
            Text(title, style: AppTypography.sectionHeading),
          ],
        ),
      ),
      if (actionLabel != null)
        TextButton(
          onPressed: onAction,
          style: TextButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
            minimumSize: const Size(48, 48),
          ),
          child: Text(
            actionLabel!,
            style: AppTypography.compactAction.copyWith(
              color: AppColors.primary,
            ),
          ),
        ),
    ],
  );
}
