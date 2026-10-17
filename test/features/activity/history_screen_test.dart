import 'package:eco_loop/app/providers/app_providers.dart';
import 'package:eco_loop/core/mock/app_clock.dart';
import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/core/mock/mock_data_store.dart';
import 'package:eco_loop/features/activity/domain/models/deposit_filter.dart';
import 'package:eco_loop/features/activity/domain/models/deposit_transaction.dart';
import 'package:eco_loop/features/activity/presentation/screens/history_screen.dart';
import 'package:eco_loop/core/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

MockDataStore _store({int depositCount = 1}) {
  final deposits = <Map<String, Object?>>[
    {
      'id': 'DEP-001',
      'residentId': 'RES-000842',
      'sessionId': null,
      'binId': 'BIN-004',
      'binLocation': 'BIN-004 · Cedar Residence',
      'materialType': 'plastic',
      'materialLabel': 'PET plastic',
      'itemCount': 2,
      'pointsAwarded': 10,
      'status': 'verified',
      'occurredAt': '2024-05-20T10:42:00+08:00',
      'verifiedAt': '2024-05-20T10:42:30+08:00',
    },
    if (depositCount > 1)
      {
        'id': 'DEP-002',
        'residentId': 'RES-000842',
        'sessionId': null,
        'binId': 'BIN-007',
        'binLocation': 'BIN-007 · Town Square',
        'materialType': 'paper',
        'materialLabel': 'Paper',
        'itemCount': 4,
        'pointsAwarded': null,
        'status': 'review',
        'occurredAt': '2024-05-16T09:08:00+08:00',
        'verifiedAt': null,
      },
  ];
  return MockDataStore(
    profile: const {'id': 'RES-000842'},
    wallet: const {
      'residentId': 'RES-000842',
      'balance': 245,
      'updatedAt': '2024-05-20T11:00:00+08:00',
      'version': 1,
    },
    deposits: deposits,
  );
}

Widget _host(MockDataStore store, {DepositFilter? routeFilter}) =>
    ProviderScope(
      overrides: [
        mockDataStoreProvider.overrideWithValue(store),
        appClockProvider.overrideWithValue(AppClock()),
        mockApiProvider.overrideWithValue(
          MockApi(readDelay: Duration.zero, writeDelay: Duration.zero),
        ),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        home: HistoryScreen(routeFilter: routeFilter),
      ),
    );

void main() {
  testWidgets('history renders the impact header and grouped rows', (
    tester,
  ) async {
    await tester.pumpWidget(_host(_store(depositCount: 2)));
    await tester.pumpAndSettle();

    expect(find.text('YOUR IMPACT'), findsOneWidget);
    expect(find.text('Recycling history'), findsOneWidget);
    expect(find.text('PET plastic'), findsOneWidget);
    expect(find.text('Verified'), findsOneWidget);
    // Demo-local stamp with per-row derived weight, bin ID shown once.
    expect(find.text('Today, 10:42 AM · 0.05 kg'), findsOneWidget);
    expect(find.text('BIN-004 · Cedar Residence'), findsOneWidget);
    // Explanatory note.
    expect(
      find.textContaining('All figures are illustrative prototype data'),
      findsOneWidget,
    );
  });

  testWidgets('filter controls open the typed sheet and apply selections', (
    tester,
  ) async {
    await tester.pumpWidget(_host(_store(depositCount: 2)));
    await tester.pumpAndSettle();

    await tester.tap(find.text('All statuses'));
    await tester.pumpAndSettle();
    expect(find.text('Filter history'), findsOneWidget);

    await tester.tap(find.widgetWithText(ChoiceChip, 'Review'));
    await tester.tap(find.text('Apply'));
    await tester.pumpAndSettle();

    expect(find.text('Paper'), findsOneWidget);
    expect(find.text('PET plastic'), findsNothing);
  });

  testWidgets('history updates after a committed deposit without refresh', (
    tester,
  ) async {
    final store = _store(depositCount: 2);
    await tester.pumpWidget(_host(store));
    await tester.pumpAndSettle();
    expect(find.text('PET plastic'), findsOneWidget);

    await store.transaction((_, _, deposits) {
      deposits.insert(0, const {
        'id': 'DEP-100',
        'residentId': 'RES-000842',
        'sessionId': 'session-1',
        'binId': 'BIN-004',
        'binLocation': 'BIN-004 · Cedar Residence',
        'materialType': 'aluminium',
        'materialLabel': 'Aluminium',
        'itemCount': 2,
        'pointsAwarded': 16,
        'status': 'verified',
        'occurredAt': '2024-05-20T10:58:00+08:00',
        'verifiedAt': '2024-05-20T10:58:30+08:00',
      });
    });
    await tester.pumpAndSettle();

    expect(find.text('Aluminium'), findsOneWidget);
  });

  testWidgets('query-derived filters apply on direct links', (tester) async {
    final store = _store(depositCount: 2);
    final clock = AppClock();
    final from = clock.calendarDate(DateTime.parse('2024-05-01T00:00+08:00'));
    await tester.pumpWidget(
      _host(
        store,
        routeFilter: DepositFilter(from: from, status: DepositStatus.review),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Paper'), findsOneWidget);
    expect(find.text('PET plastic'), findsNothing);
  });
}
