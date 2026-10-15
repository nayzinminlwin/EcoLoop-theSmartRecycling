import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

@immutable
class EcoThemeExtension extends ThemeExtension<EcoThemeExtension> {
  const EcoThemeExtension({
    this.amberText = AppColors.amberText,
    this.amberBackground = AppColors.amberBackground,
    this.redText = AppColors.redText,
    this.redBackground = AppColors.redBackground,
    this.grayText = AppColors.grayText,
    this.grayBackground = AppColors.grayBackground,
    this.scanner = AppColors.scanner,
    this.scannerCorner = AppColors.scannerCorner,
  });

  final Color amberText;
  final Color amberBackground;
  final Color redText;
  final Color redBackground;
  final Color grayText;
  final Color grayBackground;
  final Color scanner;
  final Color scannerCorner;

  @override
  EcoThemeExtension copyWith({
    Color? amberText,
    Color? amberBackground,
    Color? redText,
    Color? redBackground,
    Color? grayText,
    Color? grayBackground,
    Color? scanner,
    Color? scannerCorner,
  }) => EcoThemeExtension(
    amberText: amberText ?? this.amberText,
    amberBackground: amberBackground ?? this.amberBackground,
    redText: redText ?? this.redText,
    redBackground: redBackground ?? this.redBackground,
    grayText: grayText ?? this.grayText,
    grayBackground: grayBackground ?? this.grayBackground,
    scanner: scanner ?? this.scanner,
    scannerCorner: scannerCorner ?? this.scannerCorner,
  );

  @override
  EcoThemeExtension lerp(
    covariant ThemeExtension<EcoThemeExtension>? other,
    double t,
  ) {
    if (other is! EcoThemeExtension) return this;
    return EcoThemeExtension(
      amberText: Color.lerp(amberText, other.amberText, t)!,
      amberBackground: Color.lerp(amberBackground, other.amberBackground, t)!,
      redText: Color.lerp(redText, other.redText, t)!,
      redBackground: Color.lerp(redBackground, other.redBackground, t)!,
      grayText: Color.lerp(grayText, other.grayText, t)!,
      grayBackground: Color.lerp(grayBackground, other.grayBackground, t)!,
      scanner: Color.lerp(scanner, other.scanner, t)!,
      scannerCorner: Color.lerp(scannerCorner, other.scannerCorner, t)!,
    );
  }
}
