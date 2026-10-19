import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/core/theme/app_theme.dart';
import 'package:eco_loop/features/notifications/presentation/notification_coordinator.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class EcoLoopApp extends ConsumerWidget {
  const EcoLoopApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'EcoLoop AI',
      theme: AppTheme.light,
      routerConfig: ref.watch(appRouterProvider),
      builder: (context, child) =>
          NotificationCoordinator(child: child ?? const SizedBox.shrink()),
      debugShowCheckedModeBanner: false,
    );
  }
}
