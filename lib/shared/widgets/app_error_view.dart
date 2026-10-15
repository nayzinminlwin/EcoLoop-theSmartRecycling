import 'package:eco_loop/core/presentation/app_copy.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

class AppErrorView extends StatelessWidget {
  const AppErrorView({
    required this.message,
    super.key,
    this.onRetry,
    this.retryLabel = AppCopy.retry,
  });

  final String message;
  final VoidCallback? onRetry;
  final String retryLabel;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, color: AppColors.red, size: 40),
          const SizedBox(height: 12),
          Text(message, textAlign: TextAlign.center),
          if (onRetry != null) ...[
            const SizedBox(height: 16),
            ElevatedButton(onPressed: onRetry, child: Text(retryLabel)),
          ],
        ],
      ),
    ),
  );
}
