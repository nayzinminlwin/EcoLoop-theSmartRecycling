import 'package:flutter/material.dart';

class AppDropdownField<T> extends StatelessWidget {
  const AppDropdownField({
    required this.items,
    super.key,
    this.value,
    this.label,
    this.hint,
    this.errorText,
    this.onChanged,
  });

  final T? value;
  final String? label;
  final String? hint;
  final String? errorText;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?>? onChanged;

  @override
  Widget build(BuildContext context) => DropdownButtonFormField<T>(
    initialValue: value,
    items: items,
    onChanged: onChanged,
    decoration: InputDecoration(
      labelText: label,
      hintText: hint,
      errorText: errorText,
    ),
  );
}
