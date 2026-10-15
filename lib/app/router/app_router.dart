import 'package:eco_loop/app/presentation/bootstrap_screen.dart';
import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/core/presentation/app_copy.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

GoRouter createAppRouter() {
  return GoRouter(
    initialLocation: AppRoutes.bootstrap,
    routes: [
      GoRoute(
        path: AppRoutes.bootstrap,
        name: AppRoutes.rootName,
        builder: (context, state) => const BootstrapScreen(),
      ),
    ],
    errorBuilder: (context, state) =>
        Scaffold(body: Center(child: Text(AppCopy.pageNotFound))),
  );
}
