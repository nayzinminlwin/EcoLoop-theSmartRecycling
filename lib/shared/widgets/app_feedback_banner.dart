import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

enum AppFeedbackTone { success, info, warning, error }

class AppFeedbackBanner extends StatelessWidget {
  const AppFeedbackBanner({
    required this.message,
    super.key,
    this.tone = AppFeedbackTone.success,
    this.actionLabel,
    this.onAction,
    this.onDismiss,
  });

  final String message;
  final AppFeedbackTone tone;
  final String? actionLabel;
  final VoidCallback? onAction;
  final VoidCallback? onDismiss;

  @override
  Widget build(BuildContext context) {
    final (background, foreground, icon) = switch (tone) {
      AppFeedbackTone.success => (
        AppColors.mint,
        AppColors.primaryDark,
        Icons.check_circle_outline,
      ),
      AppFeedbackTone.info => (
        AppColors.sage,
        AppColors.primaryDark,
        Icons.info_outline,
      ),
      AppFeedbackTone.warning => (
        AppColors.amberBackground,
        AppColors.amberText,
        Icons.warning_amber_outlined,
      ),
      AppFeedbackTone.error => (
        AppColors.redBackground,
        AppColors.redText,
        Icons.error_outline,
      ),
    };
    return Semantics(
      liveRegion: true,
      container: true,
      label: message,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(icon, color: foreground),
            const SizedBox(width: 10),
            Expanded(
              child: Text(message, style: TextStyle(color: foreground)),
            ),
            if (actionLabel != null)
              TextButton(onPressed: onAction, child: Text(actionLabel!)),
            if (onDismiss != null)
              IconButton(
                onPressed: onDismiss,
                icon: const Icon(Icons.close),
                tooltip: 'Dismiss',
                color: foreground,
              ),
          ],
        ),
      ),
    );
  }
}
