import 'package:eco_loop/app/eco_loop_app.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// Shell scenarios run inside one testWidgets because a second EcoLoopApp
/// pump in the same test file never settles (binding pollution from the
/// first app's long-lived router/guard streams).
void main() {
  testWidgets('resident shell: destinations, bell, branches, and frame', (
    tester,
  ) async {
    await tester.pumpWidget(const ProviderScope(child: EcoLoopApp()));
    await tester.pumpAndSettle();

    // The three source destinations exist and scan starts its flow.
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Scan'), findsOneWidget);
    expect(find.text('Settings'), findsOneWidget);
    await tester.tap(find.text('Scan'));
    await tester.pumpAndSettle();
    expect(find.text('Scan a smart bin'), findsOneWidget);

    // Header bell routes to History.
    await tester.tap(find.byTooltip('Notifications'));
    await tester.pumpAndSettle();
    expect(find.text('YOUR IMPACT'), findsOneWidget);
    expect(find.text('Recycling history'), findsOneWidget);

    // History lives on the Home branch, so tapping Home is a same-branch
    // reselect that resets to the branch root.
    await tester.tap(find.text('Home'));
    await tester.pumpAndSettle();
    expect(find.text('Good morning, Faris'), findsOneWidget);

    // Navigation labels are compact but their cells stay tappable.
    final homeLabel = tester.getRect(find.text('Home').last);
    expect(homeLabel.height, lessThan(48));
    final homeCell = tester.getSize(
      find
          .ancestor(of: find.text('Home').last, matching: find.byType(InkWell))
          .first,
    );
    expect(homeCell.height, greaterThanOrEqualTo(48));
    expect(homeCell.width, greaterThanOrEqualTo(48));

    // Settings branch keeps its nested profile across branch switches.
    await tester.tap(find.text('Settings').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Profile & personal details'));
    await tester.pumpAndSettle();
    expect(find.text('Profile'), findsOneWidget);

    await tester.tap(find.text('Home'));
    await tester.pumpAndSettle();
    expect(find.text('Good morning, Faris'), findsOneWidget);
    await tester.tap(find.text('Settings').last);
    await tester.pumpAndSettle();
    expect(find.text('Profile'), findsOneWidget);

    // Same-branch reselect returns to the settings root.
    await tester.tap(find.text('Settings').last);
    await tester.pumpAndSettle();
    expect(find.text('Profile'), findsNothing);

    // Wide viewport: header content stays inside the centered 480px frame.
    tester.view.physicalSize = const Size(1200, 900);
    tester.view.devicePixelRatio = 1;
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    final brandLeft = tester.getTopLeft(find.text('EcoLoop AI').first).dx;
    expect(brandLeft, greaterThanOrEqualTo(360));

    // Narrow viewport: no horizontal clipping or row overflow.
    tester.view.physicalSize = const Size(320, 800);
    tester.view.devicePixelRatio = 1;
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);

    // Large text scale: rows reflow instead of overflowing.
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 2.0;
    addTearDown(tester.platformDispatcher.clearAllTestValues);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
