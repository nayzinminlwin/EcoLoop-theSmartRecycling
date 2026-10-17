import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

/// Named text roles derived from the Figma source scale.
///
/// Component styles must reference these roles instead of re-declaring
/// letter-spacing/weights so that the eyebrow's wide tracking never leaks
/// into badges, buttons, or navigation labels.
abstract final class AppTypography {
  static const fontFamily = 'Inter';

  // Page-level roles (source token scale at a normalized viewport).
  static const pageHeading = TextStyle(
    fontSize: 29,
    height: 1.15,
    letterSpacing: -1.16,
    fontWeight: FontWeight.w800,
  );
  static const homeGreeting = TextStyle(
    fontSize: 25,
    height: 1.15,
    letterSpacing: -1,
    fontWeight: FontWeight.w800,
  );
  static const sectionHeading = TextStyle(
    fontSize: 19,
    letterSpacing: -0.38,
    fontWeight: FontWeight.w700,
  );
  static const statValue = TextStyle(
    fontSize: 21,
    letterSpacing: -0.42,
    fontWeight: FontWeight.w700,
  );
  static const walletNumber = TextStyle(
    fontSize: 44,
    height: 1.1,
    letterSpacing: -2.64,
    fontWeight: FontWeight.w800,
  );
  static const body = TextStyle(fontSize: 14, height: 1.4);
  static const eyebrow = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w800,
    letterSpacing: 1.21,
  );
  static const badge = TextStyle(fontSize: 11, fontWeight: FontWeight.w700);
  static const activityTitle = TextStyle(
    fontSize: 13,
    letterSpacing: -0.26,
    fontWeight: FontWeight.w700,
  );
  static const activityMetadata = TextStyle(fontSize: 10, height: 1.35);
  static const navLabel = TextStyle(fontSize: 10, fontWeight: FontWeight.w600);
  static const compactAction = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w700,
  );

  /// Material-compatible theme used by framework widgets.
  static const textTheme = TextTheme(
    displaySmall: pageHeading,
    headlineMedium: homeGreeting,
    headlineSmall: homeGreeting,
    titleLarge: sectionHeading,
    titleMedium: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
    titleSmall: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
    bodyLarge: TextStyle(fontSize: 16, height: 1.4),
    bodyMedium: body,
    bodySmall: TextStyle(fontSize: 12, height: 1.4, color: AppColors.muted),
    labelLarge: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
    labelMedium: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
    labelSmall: TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
  );
}
