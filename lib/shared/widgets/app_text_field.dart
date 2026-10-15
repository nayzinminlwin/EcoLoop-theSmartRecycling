import 'package:flutter/material.dart';

class AppTextField extends StatelessWidget {
  const AppTextField({
    super.key,
    this.controller,
    this.initialValue,
    this.label,
    this.hint,
    this.helperText,
    this.errorText,
    this.prefixIcon,
    this.suffixIcon,
    this.keyboardType,
    this.textInputAction,
    this.obscureText = false,
    this.validator,
    this.onChanged,
    this.onSubmitted,
    this.focusNode,
    this.autofocus = false,
    this.enabled = true,
    this.maxLines = 1,
  });

  final TextEditingController? controller;
  final String? initialValue;
  final String? label;
  final String? hint;
  final String? helperText;
  final String? errorText;
  final Widget? prefixIcon;
  final Widget? suffixIcon;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final bool obscureText;
  final String? Function(String?)? validator;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final FocusNode? focusNode;
  final bool autofocus;
  final bool enabled;
  final int maxLines;

  @override
  Widget build(BuildContext context) => TextFormField(
    controller: controller,
    initialValue: controller == null ? initialValue : null,
    decoration: InputDecoration(
      labelText: label,
      hintText: hint,
      helperText: helperText,
      errorText: errorText,
      prefixIcon: prefixIcon,
      suffixIcon: suffixIcon,
    ),
    keyboardType: keyboardType,
    textInputAction: textInputAction,
    obscureText: obscureText,
    validator: validator,
    onChanged: onChanged,
    onFieldSubmitted: onSubmitted,
    focusNode: focusNode,
    autofocus: autofocus,
    enabled: enabled,
    maxLines: obscureText ? 1 : maxLines,
  );
}
