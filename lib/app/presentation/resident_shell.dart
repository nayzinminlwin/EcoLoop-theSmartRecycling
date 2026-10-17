import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_shadows.dart';
import 'package:eco_loop/core/theme/app_spacing.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'resident_bottom_navigation.dart';
import 'resident_top_bar.dart';

/// One shell Scaffold owning the shared resident frame.
///
/// The whole shell — header, content, and bottom bar — is centered and
/// constrained to 480 logical pixels; narrower viewports fill the width.
class ResidentShell extends StatelessWidget {
  const ResidentShell({required this.navigationShell, super.key});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: AppColors.background,
    child: Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: AppSpacing.maxContentWidth),
        child: DecoratedBox(
          decoration: const BoxDecoration(boxShadow: AppShadows.shellFrame),
          child: Scaffold(
            backgroundColor: AppColors.background,
            appBar: const ResidentTopBar(),
            body: navigationShell,
            bottomNavigationBar: ResidentBottomNavigation(
              navigationShell: navigationShell,
            ),
          ),
        ),
      ),
    ),
  );
}
