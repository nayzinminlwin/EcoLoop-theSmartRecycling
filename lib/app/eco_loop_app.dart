import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/core/theme/app_theme.dart';
import 'package:eco_loop/features/notifications/presentation/notification_coordinator.dart';
import 'package:eco_loop/features/scan/presentation/controllers/scan_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class EcoLoopApp extends ConsumerStatefulWidget {
  const EcoLoopApp({super.key});

  @override
  ConsumerState<EcoLoopApp> createState() => _EcoLoopAppState();
}

class _EcoLoopAppState extends ConsumerState<EcoLoopApp>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.read(activeScanSessionProvider.notifier).restore();
    }
  }

  @override
  Widget build(BuildContext context) {
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
