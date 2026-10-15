import 'package:eco_loop/app/eco_loop_app.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('EcoLoop bootstrap renders branded loading surface', (
    tester,
  ) async {
    await tester.pumpWidget(const ProviderScope(child: EcoLoopApp()));

    expect(find.text('EcoLoop AI'), findsOneWidget);
    expect(find.text('Making recycling a little greener.'), findsOneWidget);
  });
}
