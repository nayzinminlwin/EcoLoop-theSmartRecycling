import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_spacing.dart';
import 'package:eco_loop/shared/widgets/app_card.dart';
import 'package:eco_loop/shared/widgets/app_icon.dart';
import 'package:flutter/material.dart';

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
      const SizedBox(width: AppSpacing.md),
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
  Widget build(BuildContext context) => AppCard(
    onTap: onTap,
    padding: const EdgeInsets.all(AppSpacing.lg),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppIcon(icon, color: AppColors.primary, size: 24),
        const SizedBox(height: AppSpacing.md),
        Text(title, style: Theme.of(context).textTheme.titleSmall),
        Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
      ],
    ),
  );
}
