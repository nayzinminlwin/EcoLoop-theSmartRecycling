import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_shadows.dart';
import 'package:eco_loop/core/theme/app_typography.dart';
import 'package:eco_loop/features/scan/presentation/controllers/scan_controller.dart';
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
  const ResidentBottomNavigation({
    required this.navigationShell,
    required this.onBranchSelected,
    super.key,
  });

  final StatefulNavigationShell navigationShell;
  final ValueChanged<int> onBranchSelected;

  Future<void> _select(BuildContext context, WidgetRef ref, int index) async {
    final coordinator = ref.read(leaveDecisionProvider);
    if (!await coordinator.confirmLeave()) return;
    if (!context.mounted) return;

    final sameBranch = navigationShell.currentIndex == index;
    onBranchSelected(index);
    if (index == 1) {
      // Resume tracked scan work from controller state rather than the
      // current route string; cancelled work returns to the scanner for a
      // new request ID.
      final active = ref.read(activeScanSessionProvider);
      final shouldResume = active?.shouldResume ?? false;
      navigationShell.goBranch(index, initialLocation: !shouldResume);
      return;
    }
    navigationShell.goBranch(index, initialLocation: sameBranch);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) => SafeArea(
    top: false,
    child: SizedBox(
      height: 78,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.topCenter,
        children: [
          Container(
            height: 78,
            decoration: const BoxDecoration(
              color: AppColors.surface,
              border: Border(top: BorderSide(color: AppColors.border)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: _navItem(context, ref, 0, 'home', 'Home')),
                const Expanded(child: SizedBox.shrink()),
                Expanded(
                  child: _navItem(context, ref, 2, 'settings', 'Settings'),
                ),
              ],
            ),
          ),
          Positioned(top: -18, child: _scanItem(context, ref)),
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
        customBorder: const CircleBorder(),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DecoratedBox(
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.background, width: 5),
                  boxShadow: AppShadows.scanButton,
                ),
                child: const SizedBox(
                  width: 58,
                  height: 58,
                  child: Center(
                    child: AppIcon('scan', size: 28, color: Colors.white),
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Scan',
                style: AppTypography.navLabel.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
