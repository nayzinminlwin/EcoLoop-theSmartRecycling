import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class ResidentBottomNavigation extends StatelessWidget {
  const ResidentBottomNavigation({required this.navigationShell, super.key});

  final StatefulNavigationShell navigationShell;

  void _select(BuildContext context, int index) {
    if (index == navigationShell.currentIndex) return;
    navigationShell.goBranch(index, initialLocation: true);
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    top: false,
    child: SizedBox(
      height: 78,
      child: Material(
        color: Colors.white,
        elevation: 10,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _item(context, 0, Icons.home_outlined, 'Home'),
            _item(context, 1, Icons.qr_code_scanner, 'Scan', prominent: true),
            _item(context, 2, Icons.settings_outlined, 'Settings'),
          ],
        ),
      ),
    ),
  );

  Widget _item(
    BuildContext context,
    int index,
    IconData icon,
    String label, {
    bool prominent = false,
  }) {
    final selected = navigationShell.currentIndex == index;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: InkWell(
        onTap: () => _select(context, index),
        borderRadius: BorderRadius.circular(32),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 4),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DecoratedBox(
                decoration: BoxDecoration(
                  color: prominent
                      ? AppColors.primary
                      : selected
                      ? AppColors.mint
                      : Colors.transparent,
                  shape: BoxShape.circle,
                ),
                child: Padding(
                  padding: EdgeInsets.all(prominent ? 12 : 7),
                  child: Icon(
                    icon,
                    color: prominent
                        ? Colors.white
                        : selected
                        ? AppColors.primary
                        : AppColors.muted,
                  ),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                label,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: selected ? AppColors.primary : AppColors.muted,
                  fontWeight: selected ? FontWeight.w700 : null,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
