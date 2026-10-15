import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

class AppSwitchTile extends StatelessWidget {
  const AppSwitchTile({
    required this.value,
    required this.onChanged,
    super.key,
    this.title,
    this.subtitle,
  });

  final bool value;
  final ValueChanged<bool>? onChanged;
  final String? title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) => SwitchListTile.adaptive(
    value: value,
    onChanged: onChanged,
    title: title == null ? null : Text(title!),
    subtitle: subtitle == null ? null : Text(subtitle!),
    activeTrackColor: AppColors.primary,
    contentPadding: EdgeInsets.zero,
  );
}
