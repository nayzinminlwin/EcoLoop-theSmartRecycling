import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

enum AppButtonVariant { primary, secondary, danger, ghost }

class AppButton extends StatelessWidget {
  const AppButton({
    required this.label,
    super.key,
    this.onPressed,
    this.variant = AppButtonVariant.primary,
    this.leadingIcon,
    this.trailingIcon,
    this.isLoading = false,
    this.expand = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final IconData? leadingIcon;
  final IconData? trailingIcon;
  final bool isLoading;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final button = switch (variant) {
      AppButtonVariant.primary => ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppColors.primary.withValues(alpha: .45),
        ),
        child: _content(),
      ),
      AppButtonVariant.secondary => OutlinedButton(
        onPressed: isLoading ? null : onPressed,
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primary,
          side: const BorderSide(color: AppColors.primary),
        ),
        child: _content(),
      ),
      AppButtonVariant.danger => ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.red,
          foregroundColor: Colors.white,
        ),
        child: _content(),
      ),
      AppButtonVariant.ghost => TextButton(
        onPressed: isLoading ? null : onPressed,
        style: TextButton.styleFrom(foregroundColor: AppColors.primary),
        child: _content(),
      ),
    };
    return Semantics(
      button: true,
      enabled: !isLoading && onPressed != null,
      label: label,
      child: SizedBox(
        width: expand ? double.infinity : null,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: button,
        ),
      ),
    );
  }

  Widget _content() {
    final labelContent = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (leadingIcon != null) Icon(leadingIcon, size: 18),
        if (leadingIcon != null) const SizedBox(width: 8),
        // Flexible so long labels wrap instead of overflowing at narrow
        // widths or enlarged text scales.
        Flexible(child: Text(label, textAlign: TextAlign.center)),
        if (trailingIcon != null) const SizedBox(width: 8),
        if (trailingIcon != null) Icon(trailingIcon, size: 18),
      ],
    );
    return Stack(
      alignment: Alignment.center,
      children: [
        Opacity(opacity: isLoading ? 0 : 1, child: labelContent),
        if (isLoading)
          const SizedBox.square(
            dimension: 20,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: Colors.white,
            ),
          ),
      ],
    );
  }
}
