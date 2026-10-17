import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_radii.dart';
import 'package:eco_loop/core/theme/app_typography.dart';
import 'package:eco_loop/shared/widgets/app_icon.dart';
import 'package:flutter/material.dart';

/// Two white bordered quick-action cards with mint icon tiles.
class HomeQuickActions extends StatelessWidget {
  const HomeQuickActions({
    required this.onGuide,
    required this.onHistory,
    super.key,
  });

  final VoidCallback onGuide;
  final VoidCallback onHistory;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: _Action(
          icon: 'book',
          title: 'How to recycle',
          subtitle: 'Quick guide',
          onTap: onGuide,
        ),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: _Action(
          icon: 'history',
          title: 'Recycling history',
          subtitle: 'View activity',
          onTap: onHistory,
        ),
      ),
    ],
  );
}

class _Action extends StatelessWidget {
  const _Action({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });
  final String icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: AppColors.surface,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AppRadii.card),
      side: const BorderSide(color: AppColors.border),
    ),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(15),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: AppColors.mint,
                borderRadius: BorderRadius.circular(AppRadii.iconTile),
              ),
              child: Center(
                child: AppIcon(icon, size: 20, color: AppColors.primary),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              title,
              style: AppTypography.activityTitle.copyWith(
                color: AppColors.text,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: AppTypography.activityMetadata.copyWith(
                fontSize: 11,
                color: AppColors.muted,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
