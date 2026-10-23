import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_shadows.dart';
import 'package:eco_loop/core/theme/app_spacing.dart';
import 'package:eco_loop/app/router/app_routes.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'resident_bottom_navigation.dart';
import 'resident_top_bar.dart';

/// One shell Scaffold owning the shared resident frame.
///
/// The whole shell — header, content, and bottom bar — is centered and
/// constrained to 480 logical pixels; narrower viewports fill the width.
class ResidentShell extends StatefulWidget {
  const ResidentShell({required this.navigationShell, super.key});

  final StatefulNavigationShell navigationShell;

  @override
  State<ResidentShell> createState() => _ResidentShellState();
}

class _ResidentShellState extends State<ResidentShell> {
  final List<int> _tabHistory = [];

  StatefulNavigationShell get navigationShell => widget.navigationShell;

  void _recordBranch(int index) {
    if (navigationShell.currentIndex == index ||
        _tabHistory.lastOrNull == navigationShell.currentIndex) {
      return;
    }
    _tabHistory.add(navigationShell.currentIndex);
  }

  bool _canExitNormally(BuildContext context) {
    final path = GoRouterState.of(context).uri.path;
    return path == AppRoutes.home &&
        navigationShell.currentIndex == 0 &&
        _tabHistory.isEmpty &&
        !GoRouter.of(context).canPop();
  }

  void _handleBack(BuildContext context) {
    if (GoRouter.of(context).canPop()) return;

    if (_tabHistory.isNotEmpty) {
      final previous = _tabHistory.removeLast();
      navigationShell.goBranch(previous);
      return;
    }

    final path = GoRouterState.of(context).uri.path;
    final fallback = switch (path) {
      AppRoutes.guide ||
      AppRoutes.history ||
      AppRoutes.rewards => AppRoutes.home,
      AppRoutes.vouchers => AppRoutes.rewards,
      AppRoutes.voucherDetail => AppRoutes.vouchers,
      AppRoutes.profile ||
      AppRoutes.security ||
      AppRoutes.notificationPreferences => AppRoutes.settings,
      AppRoutes.scanBin ||
      AppRoutes.scanReady ||
      AppRoutes.scanDetected ||
      AppRoutes.scanProcessing ||
      AppRoutes.scanResult => AppRoutes.scan,
      _ => null,
    };
    if (fallback != null) context.go(fallback);
  }

  @override
  Widget build(BuildContext context) {
    final canExitNormally = _canExitNormally(context);
    return PopScope(
      canPop: canExitNormally || GoRouter.of(context).canPop(),
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _handleBack(context);
      },
      child: ColoredBox(
        color: AppColors.background,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              maxWidth: AppSpacing.maxContentWidth,
            ),
            child: DecoratedBox(
              decoration: const BoxDecoration(boxShadow: AppShadows.shellFrame),
              child: Scaffold(
                backgroundColor: AppColors.background,
                appBar: const ResidentTopBar(),
                body: navigationShell,
                bottomNavigationBar: ResidentBottomNavigation(
                  navigationShell: navigationShell,
                  onBranchSelected: _recordBranch,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
