import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_radii.dart';
import 'package:eco_loop/core/theme/app_spacing.dart';
import 'package:eco_loop/shared/widgets/app_brand.dart';
import 'package:eco_loop/shared/widgets/app_icon.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Shared resident header: brand wordmark plus an outlined notification bell
/// that routes to History, matching the source header composition.
class ResidentTopBar extends StatelessWidget implements PreferredSizeWidget {
  const ResidentTopBar({super.key});

  @override
  Size get preferredSize => const Size.fromHeight(72);

  @override
  Widget build(BuildContext context) => AppBar(
    toolbarHeight: 72,
    backgroundColor: AppColors.background,
    surfaceTintColor: Colors.transparent,
    automaticallyImplyLeading: false,
    titleSpacing: AppSpacing.page,
    shape: const Border(bottom: BorderSide(color: AppColors.topBarBorder)),
    title: const FittedBox(
      fit: BoxFit.scaleDown,
      alignment: Alignment.centerLeft,
      child: AppBrand(),
    ),
    actions: [
      Padding(
        padding: const EdgeInsets.only(right: 17),
        child: Semantics(
          button: true,
          label: 'Notifications',
          child: InkWell(
            onTap: () => context.push(AppRoutes.history),
            customBorder: const CircleBorder(),
            child: Tooltip(
              message: 'Notifications',
              child: SizedBox(
                width: 48,
                height: 48,
                child: Center(
                  child: Material(
                    color: AppColors.surface,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadii.button),
                      side: const BorderSide(color: AppColors.border),
                    ),
                    child: SizedBox(
                      width: 42,
                      height: 42,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          const AppIcon('bell', color: AppColors.text),
                          Positioned(
                            right: 7,
                            top: 7,
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                color: AppColors.red,
                                shape: BoxShape.circle,
                                border: Border.fromBorderSide(
                                  BorderSide(color: Colors.white, width: 2),
                                ),
                              ),
                              child: SizedBox(width: 7, height: 7),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ],
  );
}
