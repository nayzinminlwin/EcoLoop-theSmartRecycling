import 'package:eco_loop/app/eco_loop_app.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('EcoLoop home renders resident dashboard', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: EcoLoopApp()));
    await tester.pumpAndSettle();

    expect(find.text('Good morning, Faris'), findsOneWidget);
    expect(find.text('245'), findsOneWidget);
  });
}
