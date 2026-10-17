import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/app/router/route_guards.dart';
import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/features/account/data/mock_account_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'deep links parked during startup restoration keep path and query',
    () async {
      final repository = MockAccountRepository(
        api: MockApi(readDelay: Duration.zero),
      );
      final guards = RouteGuards(repository);
      addTearDown(guards.dispose);

      final deepLink = Uri.parse(
        '${AppRoutes.settings}/profile?section=details',
      );

      // Before auth resolves, everything except the root parks on bootstrap
      // and the full URI is remembered; the latest deep link wins.
      expect(guards.isResolved, isFalse);
      expect(guards.redirect(deepLink), AppRoutes.root);
      expect(guards.redirect(Uri.parse(AppRoutes.root)), isNull);
      final lastLink = Uri.parse(AppRoutes.history);
      expect(guards.redirect(lastLink), AppRoutes.root);

      // Once the resident resolves, the root resumes the last requested
      // destination and the pending location is consumed exactly once.
      await repository.getAuthState();
      // The watch stream delivers asynchronously; pump via a microtask wait.
      await Future<void>.delayed(Duration.zero);
      expect(guards.isResolved, isTrue);
      expect(guards.isResident, isTrue);

      expect(guards.redirect(Uri.parse(AppRoutes.root)), lastLink.toString());
      expect(guards.redirect(Uri.parse(AppRoutes.root)), AppRoutes.home);
    },
  );

  test(
    'signed-out residents keep their requested destination for resume',
    () async {
      final repository = MockAccountRepository(
        api: MockApi(readDelay: Duration.zero),
      );
      final guards = RouteGuards(repository);
      addTearDown(guards.dispose);

      await repository.signOut();
      await Future<void>.delayed(Duration.zero);
      expect(guards.isResident, isFalse);

      final deepLink = Uri.parse(AppRoutes.history);
      expect(guards.redirect(deepLink), AppRoutes.signedOut);
      expect(guards.redirect(Uri.parse(AppRoutes.signedOut)), isNull);

      await repository.resumeDemoSession();
      await Future<void>.delayed(Duration.zero);
      expect(guards.isResident, isTrue);
      expect(
        guards.redirect(Uri.parse(AppRoutes.signedOut)),
        deepLink.toString(),
      );
    },
  );

  test(
    'malformed calendar query values recover to the clean history route',
    () async {
      final repository = MockAccountRepository(
        api: MockApi(readDelay: Duration.zero),
      );
      final guards = RouteGuards(repository);
      addTearDown(guards.dispose);
      await repository.getAuthState();
      await Future<void>.delayed(Duration.zero);

      // The guard-level redirect only handles auth; the history route's own
      // redirect (covered in the router) sanitizes bad queries. The guard
      // must not crash on odd URIs.
      expect(
        guards.redirect(Uri.parse('/history?from=%&to=2024-13-77')),
        isNull,
      );
    },
  );
}
