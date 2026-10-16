import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class ResidentTopBar extends StatelessWidget implements PreferredSizeWidget {
  const ResidentTopBar({super.key});

  @override
  Size get preferredSize => const Size.fromHeight(72);

  @override
  Widget build(BuildContext context) => AppBar(
    backgroundColor: AppColors.background,
    surfaceTintColor: Colors.transparent,
    automaticallyImplyLeading: false,
    title: const Text('EcoLoop'),
    actions: [
      IconButton(
        tooltip: 'Notifications',
        onPressed: () => context.go(AppRoutes.notificationPreferences),
        icon: const Icon(Icons.notifications_none),
      ),
      const SizedBox(width: 8),
    ],
  );
}
