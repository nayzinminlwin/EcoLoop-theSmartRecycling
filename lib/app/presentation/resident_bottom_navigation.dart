import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_shadows.dart';
import 'package:eco_loop/core/theme/app_typography.dart';
import 'package:eco_loop/shared/widgets/app_icon.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Bottom navigation with the raised scan affordance.
///
/// Branch selection reflects the actual destination: Home/Settings show a
/// selected label only for their own branch, and same-branch reselect resets
/// the branch to its root while switching branches preserves nested routes.
class ResidentBottomNavigation extends ConsumerWidget {
  const ResidentBottomNavigation({required this.navigationShell, super.key});

  final StatefulNavigationShell navigationShell;

  Future<void> _select(BuildContext context, WidgetRef ref, int index) async {
    final coordinator = ref.read(leaveDecisionProvider);
    if (!await coordinator.confirmLeave()) return;
    if (!context.mounted) return;

    final isScan = index == 1;
    final currentPath = GoRouterState.of(context).uri.path;
    final sameBranch = navigationShell.currentIndex == index;
    if (isScan) {
      final scanHasActiveSession =
          currentPath.startsWith('/scan/sessions/') &&
          !currentPath.endsWith('/result');
      navigationShell.goBranch(index, initialLocation: !scanHasActiveSession);
      return;
    }
    navigationShell.goBranch(index, initialLocation: sameBranch);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) => SafeArea(
    top: false,
    child: Container(
      height: 78,
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(child: _navItem(context, ref, 0, 'home', 'Home')),
          Expanded(child: _scanItem(context, ref)),
          Expanded(child: _navItem(context, ref, 2, 'settings', 'Settings')),
        ],
      ),
    ),
  );

  Widget _navItem(
    BuildContext context,
    WidgetRef ref,
    int index,
    String icon,
    String label,
  ) {
    final selected = navigationShell.currentIndex == index;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: InkWell(
        onTap: () => _select(context, ref, index),
        child: Center(
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                AppIcon(
                  icon,
                  size: 20,
                  color: selected ? AppColors.primary : AppColors.navMuted,
                ),
                const SizedBox(height: 4),
                Text(
                  label,
                  style: AppTypography.navLabel.copyWith(
                    color: selected ? AppColors.primary : AppColors.navMuted,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _scanItem(BuildContext context, WidgetRef ref) {
    final selected = navigationShell.currentIndex == 1;
    return Semantics(
      button: true,
      selected: selected,
      label: 'Scan',
      child: InkWell(
        onTap: () => _select(context, ref, 1),
        child: Center(
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Transform.translate(
                  offset: const Offset(0, -22),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.background, width: 5),
                      boxShadow: AppShadows.scanButton,
                    ),
                    child: SizedBox(
                      width: 58,
                      height: 58,
                      child: Center(
                        child: AppIcon('scan', size: 28, color: Colors.white),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Scan',
                  style: AppTypography.navLabel.copyWith(
                    color: selected ? AppColors.primary : AppColors.navMuted,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
