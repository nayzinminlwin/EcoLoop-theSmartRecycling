import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

class AppFilterChip<T> extends StatelessWidget {
  const AppFilterChip({
    required this.label,
    required this.selected,
    required this.onSelected,
    super.key,
    this.value,
  });

  final String label;
  final bool selected;
  final T? value;
  final ValueChanged<bool> onSelected;

  @override
  Widget build(BuildContext context) => FilterChip(
    label: Text(label),
    selected: selected,
    onSelected: onSelected,
    showCheckmark: false,
    selectedColor: AppColors.sage,
    side: BorderSide(
      color: selected ? AppColors.primary : AppColors.border,
    ),
  );
}
