import 'package:flutter/material.dart';
import 'package:eco_loop/core/theme/app_colors.dart';

class ScannerFrame extends StatelessWidget {
  const ScannerFrame({super.key, this.child});
  final Widget? child;

  @override
  Widget build(BuildContext context) => Container(
    height: 300,
    decoration: BoxDecoration(
      color: const Color(0xFF16251D),
      borderRadius: BorderRadius.circular(22),
      border: Border.all(color: const Color(0xFF65BF8F), width: 2),
    ),
    child: Center(
      child:
          child ??
          const Icon(Icons.qr_code_scanner, color: AppColors.mint, size: 88),
    ),
  );
}
