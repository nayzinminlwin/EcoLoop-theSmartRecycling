import 'package:eco_loop/app/presentation/bootstrap_screen.dart';
import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/core/presentation/app_copy.dart';
import 'package:eco_loop/features/activity/presentation/screens/history_screen.dart';
import 'package:eco_loop/features/home/presentation/screens/home_screen.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

GoRouter createAppRouter() {
  return GoRouter(
    initialLocation: AppRoutes.home,
    routes: [
      GoRoute(
        path: AppRoutes.bootstrap,
        name: AppRoutes.rootName,
        builder: (context, state) => const BootstrapScreen(),
      ),
      GoRoute(
        path: AppRoutes.home,
        name: AppRoutes.homeName,
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: AppRoutes.history,
        name: AppRoutes.historyName,
        builder: (context, state) => const HistoryScreen(),
      ),
    ],
    errorBuilder: (context, state) =>
        Scaffold(body: Center(child: Text(AppCopy.pageNotFound))),
  );
}
