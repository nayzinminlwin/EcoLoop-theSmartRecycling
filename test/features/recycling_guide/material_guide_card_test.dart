import 'package:eco_loop/features/recycling_guide/domain/models/recycling_material.dart';
import 'package:eco_loop/features/recycling_guide/presentation/widgets/material_guide_card.dart';
import 'package:eco_loop/core/domain/material_type.dart';
import 'package:flutter/material.dart' show Image, MaterialApp;
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Firebase material identifiers select the illustrated asset', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: MaterialGuideCard(
          material: const RecyclingMaterial(
            id: 'paper-bags',
            type: MaterialType.paper,
            canonicalClass: 'paper_bag',
            title: 'Paper bags',
            preparationTip: 'Keep clean and dry.',
            iconKey: 'shopping-bag',
            sortOrder: 5,
          ),
        ),
      ),
    );

    expect(find.byType(Image), findsOneWidget);
    expect(find.text('Paper bags'), findsOneWidget);
    expect(find.text('Keep clean and dry.'), findsOneWidget);
  });
}
