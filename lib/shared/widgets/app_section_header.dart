import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

class AppSectionHeader extends StatelessWidget {
  const AppSectionHeader({
    required this.title,
    super.key,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: Text(title, style: Theme.of(context).textTheme.titleMedium),
      ),
      if (actionLabel != null)
        TextButton(
          onPressed: onAction,
          child: Text(
            actionLabel!,
            style: const TextStyle(color: AppColors.primary),
          ),
        ),
    ],
  );
}
