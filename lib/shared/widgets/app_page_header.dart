import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_spacing.dart';
import 'package:flutter/material.dart';

class AppPageHeader extends StatelessWidget implements PreferredSizeWidget {
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
  Size get preferredSize => const Size.fromHeight(72);

  @override
  Widget build(BuildContext context) => AppBar(
    automaticallyImplyLeading: false,
    leading: onBack == null
        ? null
        : IconButton(
            onPressed: onBack,
            icon: const Icon(Icons.arrow_back),
            tooltip: 'Back',
          ),
    titleSpacing: onBack == null ? 20 : 0,
    title: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (eyebrow != null)
          Text(
            eyebrow!,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: AppColors.muted,
            ),
          ),
        Text(title, style: Theme.of(context).textTheme.titleLarge),
      ],
    ),
    actions: trailing == null
        ? null
        : [Padding(padding: const EdgeInsets.only(right: AppSpacing.sm), child: trailing)],
  );
}
