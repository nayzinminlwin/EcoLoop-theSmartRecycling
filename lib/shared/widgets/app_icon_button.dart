import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

class AppIconButton extends StatelessWidget {
  const AppIconButton({
    required this.icon,
    required this.onPressed,
    super.key,
    this.tooltip,
    this.color,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final String? tooltip;
  final Color? color;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: tooltip,
    child: IconButton(
      onPressed: onPressed,
      icon: Icon(icon, color: color ?? AppColors.text),
      tooltip: tooltip,
      constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
    ),
  );
}
