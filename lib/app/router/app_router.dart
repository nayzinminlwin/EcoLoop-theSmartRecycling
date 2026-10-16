import 'package:eco_loop/app/presentation/bootstrap_screen.dart';
import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/core/presentation/app_copy.dart';
import 'package:eco_loop/features/activity/presentation/screens/history_screen.dart';
import 'package:eco_loop/features/account/presentation/screens/demo_session_screen.dart';
import 'package:eco_loop/features/account/presentation/screens/notification_preferences_screen.dart';
import 'package:eco_loop/features/account/presentation/screens/profile_screen.dart';
import 'package:eco_loop/features/account/presentation/screens/security_screen.dart';
import 'package:eco_loop/features/account/presentation/screens/settings_screen.dart';
import 'package:eco_loop/features/home/presentation/screens/home_screen.dart';
import 'package:eco_loop/features/recycling_guide/presentation/screens/recycling_guide_screen.dart';
import 'package:eco_loop/features/scan/presentation/screens/scan_screen.dart';
import 'package:eco_loop/features/scan/presentation/screens/scan_session_screen.dart';
import 'package:eco_loop/features/scan/domain/models/deposit_session.dart';
import 'package:eco_loop/features/rewards/domain/models/resident_voucher.dart';
import 'package:eco_loop/features/rewards/presentation/screens/rewards_screen.dart';
import 'package:eco_loop/features/rewards/presentation/screens/voucher_detail_screen.dart';
import 'package:eco_loop/features/rewards/presentation/screens/vouchers_screen.dart';
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
        path: AppRoutes.signedOut,
        name: AppRoutes.signedOutName,
        builder: (context, state) => const DemoSessionScreen(),
      ),
      GoRoute(
        path: AppRoutes.history,
        name: AppRoutes.historyName,
        builder: (context, state) => const HistoryScreen(),
      ),
      GoRoute(
        path: AppRoutes.guide,
        name: AppRoutes.guideName,
        builder: (context, state) => const RecyclingGuideScreen(),
      ),
      GoRoute(
        path: AppRoutes.rewards,
        name: AppRoutes.rewardsName,
        redirect: (context, state) {
          const knownCategories = {'food', 'shopping'};
          final category = state.uri.queryParameters['category'];
          return category != null && !knownCategories.contains(category)
              ? AppRoutes.rewards
              : null;
        },
        builder: (context, state) =>
            RewardsScreen(categoryId: state.uri.queryParameters['category']),
      ),
      GoRoute(
        path: AppRoutes.vouchers,
        name: AppRoutes.vouchersName,
        redirect: (context, state) {
          const knownStatuses = {'available', 'used', 'expired'};
          final status = state.uri.queryParameters['status'];
          return status != null && !knownStatuses.contains(status)
              ? AppRoutes.vouchers
              : null;
        },
        builder: (context, state) => VouchersScreen(
          status: VoucherStatus.values
              .where(
                (status) =>
                    status.wireValue == state.uri.queryParameters['status'],
              )
              .firstOrNull,
        ),
      ),
      GoRoute(
        path: AppRoutes.voucherDetail,
        name: AppRoutes.voucherDetailName,
        builder: (context, state) =>
            VoucherDetailScreen(voucherId: state.pathParameters['voucherId']!),
      ),
      GoRoute(
        path: AppRoutes.scan,
        name: AppRoutes.scanName,
        builder: (context, state) => const ScanScreen(),
      ),
      GoRoute(
        path: AppRoutes.settings,
        name: AppRoutes.settingsName,
        builder: (context, state) => const SettingsScreen(),
      ),
      GoRoute(
        path: AppRoutes.profile,
        name: AppRoutes.profileName,
        builder: (context, state) => const ProfileScreen(),
      ),
      GoRoute(
        path: AppRoutes.security,
        name: AppRoutes.securityName,
        builder: (context, state) => const SecurityScreen(),
      ),
      GoRoute(
        path: AppRoutes.notificationPreferences,
        name: AppRoutes.notificationPreferencesName,
        builder: (context, state) => const NotificationPreferencesScreen(),
      ),
      for (final entry in <({String path, String name, ScanStage stage})>[
        (
          path: AppRoutes.scanBin,
          name: AppRoutes.scanBinName,
          stage: ScanStage.binFound,
        ),
        (
          path: AppRoutes.scanReady,
          name: AppRoutes.scanReadyName,
          stage: ScanStage.ready,
        ),
        (
          path: AppRoutes.scanDetected,
          name: AppRoutes.scanDetectedName,
          stage: ScanStage.itemDetected,
        ),
        (
          path: AppRoutes.scanProcessing,
          name: AppRoutes.scanProcessingName,
          stage: ScanStage.processing,
        ),
        (
          path: AppRoutes.scanResult,
          name: AppRoutes.scanResultName,
          stage: ScanStage.completed,
        ),
      ])
        GoRoute(
          path: entry.path,
          name: entry.name,
          builder: (context, state) => ScanSessionScreen(
            sessionId: state.pathParameters['sessionId']!,
            expectedStage: entry.stage,
          ),
        ),
    ],
    errorBuilder: (context, state) =>
        Scaffold(body: Center(child: Text(AppCopy.pageNotFound))),
  );
}
