import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/app/router/app_router.dart';
import 'package:eco_loop/app/router/route_parameter_parsers.dart';
import 'package:eco_loop/features/activity/domain/models/deposit_transaction.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('registers the complete resident route table', () {
    final router = createAppRouter();

    expect(router.namedLocation(AppRoutes.rootName), '/');
    expect(router.namedLocation(AppRoutes.homeName), '/home');
    expect(router.namedLocation(AppRoutes.guideName), '/guide');
    expect(router.namedLocation(AppRoutes.historyName), '/history');
    expect(router.namedLocation(AppRoutes.rewardsName), '/rewards');
    expect(router.namedLocation(AppRoutes.vouchersName), '/vouchers');
    expect(
      router.namedLocation(
        AppRoutes.voucherDetailName,
        pathParameters: {'voucherId': 'voucher-1'},
      ),
      '/vouchers/voucher-1',
    );
    expect(router.namedLocation(AppRoutes.scanName), '/scan');
    expect(router.namedLocation(AppRoutes.settingsName), '/settings');
    expect(
      router.namedLocation(AppRoutes.notificationPreferencesName),
      '/settings/notifications',
    );
  });

  test('normalizes route parameters without widget-local parsing', () {
    final filter = RouteParameterParsers.historyFilter({
      'from': '2024-05-18',
      'to': '2024-05-20',
      'status': 'verified',
    });

    expect(filter.from, DateTime(2024, 5, 18));
    expect(filter.toExclusive, DateTime(2024, 5, 21));
    expect(filter.status, DepositStatus.verified);
    expect(RouteParameterParsers.opaqueId('  voucher-1 '), 'voucher-1');
    expect(RouteParameterParsers.opaqueId(''), isNull);
    expect(RouteParameterParsers.depositStatus('not-a-status'), isNull);
  });
}
