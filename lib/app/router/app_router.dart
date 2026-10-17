import 'package:eco_loop/app/presentation/resident_shell.dart';
import 'package:eco_loop/app/presentation/route_error_screen.dart';
import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/app/router/route_guards.dart';
import 'package:eco_loop/app/router/route_parameter_parsers.dart';
import 'package:eco_loop/app/presentation/bootstrap_screen.dart';
import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/features/activity/presentation/screens/history_screen.dart';
import 'package:eco_loop/features/account/presentation/screens/demo_session_screen.dart';
import 'package:eco_loop/features/account/domain/repositories/account_repository.dart';
import 'package:eco_loop/features/account/presentation/screens/notification_preferences_screen.dart';
import 'package:eco_loop/features/account/presentation/screens/profile_screen.dart';
import 'package:eco_loop/features/account/presentation/screens/security_screen.dart';
import 'package:eco_loop/features/account/presentation/screens/settings_screen.dart';
import 'package:eco_loop/features/account/data/mock_account_repository.dart';
import 'package:eco_loop/features/home/presentation/screens/home_screen.dart';
import 'package:eco_loop/features/recycling_guide/presentation/screens/recycling_guide_screen.dart';
import 'package:eco_loop/features/scan/domain/models/deposit_session.dart';
import 'package:eco_loop/features/scan/presentation/screens/scan_screen.dart';
import 'package:eco_loop/features/scan/presentation/screens/scan_session_screen.dart';
import 'package:eco_loop/features/rewards/presentation/screens/rewards_screen.dart';
import 'package:eco_loop/features/rewards/presentation/screens/voucher_detail_screen.dart';
import 'package:eco_loop/features/rewards/presentation/screens/vouchers_screen.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

String _scanStagePath(ScanStage stage, String sessionId) => switch (stage) {
  ScanStage.binFound => AppRoutes.scanBinPath(sessionId),
  ScanStage.ready => AppRoutes.scanReadyPath(sessionId),
  ScanStage.itemDetected => AppRoutes.scanDetectedPath(sessionId),
  ScanStage.processing => AppRoutes.scanProcessingPath(sessionId),
  ScanStage.completed => AppRoutes.scanResultPath(sessionId),
  ScanStage.cancelled => AppRoutes.scan,
};

GoRouter createAppRouter({
  AccountRepository? accountRepository,
  ScanStage? Function(String sessionId)? resolveSessionStage,
  int utcOffsetMinutes = 480,
}) {
  final guards = RouteGuards(
    accountRepository ??
        MockAccountRepository(api: MockApi(readDelay: Duration.zero)),
  );

  GoRoute scanStageRoute({
    required String path,
    required String name,
    required ScanStage stage,
  }) => GoRoute(
    path: path,
    name: name,
    redirect: (context, state) {
      final sessionId = RouteParameterParsers.opaqueId(
        state.pathParameters['sessionId'],
      );
      if (sessionId == null) return AppRoutes.scan;
      // Canonicalize stale/future-stage URLs to the committed stage state so
      // no stage can be skipped by typing a URL.
      final committed = resolveSessionStage?.call(sessionId);
      if (committed != null && committed != stage) {
        return _scanStagePath(committed, sessionId);
      }
      return null;
    },
    builder: (context, state) => ScanSessionScreen(
      sessionId: RouteParameterParsers.opaqueId(
        state.pathParameters['sessionId'],
      )!,
      expectedStage: stage,
    ),
  );

  final homeBranch = StatefulShellBranch(
    navigatorKey: GlobalKey<NavigatorState>(debugLabel: 'homeNavigator'),
    routes: [
      GoRoute(
        path: AppRoutes.home,
        name: AppRoutes.homeName,
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: AppRoutes.guide,
        name: AppRoutes.guideName,
        builder: (context, state) => const RecyclingGuideScreen(),
      ),
      GoRoute(
        path: AppRoutes.history,
        name: AppRoutes.historyName,
        redirect: (context, state) {
          final query = state.uri.queryParameters;
          final hasInvalidDate =
              (query['from'] != null &&
                  RouteParameterParsers.calendarDate(
                        query['from'],
                        utcOffsetMinutes: utcOffsetMinutes,
                      ) ==
                      null) ||
              (query['to'] != null &&
                  RouteParameterParsers.calendarDate(
                        query['to'],
                        utcOffsetMinutes: utcOffsetMinutes,
                      ) ==
                      null);
          final hasInvalidStatus =
              query['status'] != null &&
              RouteParameterParsers.depositStatus(query['status']) == null;
          return hasInvalidDate || hasInvalidStatus ? AppRoutes.history : null;
        },
        builder: (context, state) => HistoryScreen(
          routeFilter: RouteParameterParsers.historyFilter(
            state.uri.queryParameters,
            utcOffsetMinutes: utcOffsetMinutes,
          ),
        ),
      ),
      GoRoute(
        path: AppRoutes.rewards,
        name: AppRoutes.rewardsName,
        redirect: (context, state) {
          final category = state.uri.queryParameters['category'];
          return category != null && !{'food', 'shopping'}.contains(category)
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
          final status = state.uri.queryParameters['status'];
          return status != null &&
                  RouteParameterParsers.voucherStatus(status) == null
              ? AppRoutes.vouchers
              : null;
        },
        builder: (context, state) => VouchersScreen(
          status: RouteParameterParsers.voucherStatus(
            state.uri.queryParameters['status'],
          ),
        ),
      ),
      GoRoute(
        path: AppRoutes.voucherDetail,
        name: AppRoutes.voucherDetailName,
        redirect: (context, state) =>
            RouteParameterParsers.opaqueId(state.pathParameters['voucherId']) ==
                null
            ? AppRoutes.vouchers
            : null,
        builder: (context, state) => VoucherDetailScreen(
          voucherId: RouteParameterParsers.opaqueId(
            state.pathParameters['voucherId'],
          )!,
        ),
      ),
    ],
  );

  final scanBranch = StatefulShellBranch(
    navigatorKey: GlobalKey<NavigatorState>(debugLabel: 'scanNavigator'),
    routes: [
      GoRoute(
        path: AppRoutes.scan,
        name: AppRoutes.scanName,
        builder: (context, state) => const ScanScreen(),
      ),
      scanStageRoute(
        path: AppRoutes.scanBin,
        name: AppRoutes.scanBinName,
        stage: ScanStage.binFound,
      ),
      scanStageRoute(
        path: AppRoutes.scanReady,
        name: AppRoutes.scanReadyName,
        stage: ScanStage.ready,
      ),
      scanStageRoute(
        path: AppRoutes.scanDetected,
        name: AppRoutes.scanDetectedName,
        stage: ScanStage.itemDetected,
      ),
      scanStageRoute(
        path: AppRoutes.scanProcessing,
        name: AppRoutes.scanProcessingName,
        stage: ScanStage.processing,
      ),
      scanStageRoute(
        path: AppRoutes.scanResult,
        name: AppRoutes.scanResultName,
        stage: ScanStage.completed,
      ),
    ],
  );

  final settingsBranch = StatefulShellBranch(
    navigatorKey: GlobalKey<NavigatorState>(debugLabel: 'settingsNavigator'),
    routes: [
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
    ],
  );

  return GoRouter(
    initialLocation: AppRoutes.root,
    refreshListenable: guards,
    redirect: (context, state) => guards.redirect(state.uri),
    routes: [
      GoRoute(
        path: AppRoutes.root,
        name: AppRoutes.rootName,
        builder: (context, state) =>
            BootstrapScreen(hasError: guards.hasError, onRetry: guards.retry),
      ),
      GoRoute(
        path: AppRoutes.signedOut,
        name: AppRoutes.signedOutName,
        builder: (context, state) => const DemoSessionScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            ResidentShell(navigationShell: navigationShell),
        branches: [homeBranch, scanBranch, settingsBranch],
      ),
    ],
    errorBuilder: (context, state) => RouteErrorScreen(error: state),
  );
}
