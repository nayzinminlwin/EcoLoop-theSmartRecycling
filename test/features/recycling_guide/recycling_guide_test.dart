import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/features/recycling_guide/data/mock_recycling_guide_repository.dart';
import 'package:eco_loop/features/recycling_guide/domain/models/material_rate.dart';
import 'package:eco_loop/features/recycling_guide/domain/models/recycling_guide.dart';
import 'package:eco_loop/features/recycling_guide/domain/models/recycling_guide_content.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<MockRecyclingGuideRepository> createRepository() async =>
      MockRecyclingGuideRepository(
        api: MockApi(readDelay: Duration.zero, writeDelay: Duration.zero),
      );

  test('guide fixture composes stable content and count-based rates', () async {
    final repository = await createRepository();
    final guide = await repository.getGuide();

    expect(guide.materials.map((item) => item.title), [
      'Plastic bottles',
      'Glass bottles',
      'Metal cans',
      'Paper & cardboard',
    ]);
    expect(guide.steps, hasLength(5));
    expect(guide.toDo, hasLength(3));
    final plastic = guide.rates.firstWhere(
      (rate) => rate.materialType.wireValue == 'plastic',
    );
    expect(plastic.pointsFor(2), 10);
    expect(
      guide.rates
          .firstWhere((rate) => rate.displayName == 'Aluminium')
          .pointsFor(2),
      16,
    );
    expect(
      guide.rates
          .firstWhere((rate) => rate.displayName == 'Paper')
          .pointsFor(4),
      12,
    );
  });

  test('all persisted guide models round-trip as JSON', () async {
    final repository = await createRepository();
    final guide = await repository.getGuide();
    final decoded = RecyclingGuide.fromJson(guide.toJson());

    expect(decoded.toJson(), guide.toJson());
    expect(MaterialRate.fromJson(guide.rates.first.toJson()).pointsFor(2), 10);
  });

  test(
    'mock updates remain available through later reads and watch streams',
    () async {
      final repository = await createRepository();
      final initial = await repository.getGuide();
      final updated = RecyclingGuide.compose(
        content: RecyclingGuideContent(
          heroTitle: 'Updated guide',
          heroDescription: initial.heroDescription,
          toDo: initial.toDo,
          toAvoid: initial.toAvoid,
          pointsDisclaimer: initial.pointsDisclaimer,
        ),
        materials: initial.materials,
        steps: initial.steps,
        rates: initial.rates,
      );

      await repository.updateGuide(updated);

      expect((await repository.getGuide()).heroTitle, 'Updated guide');
      final stream = repository.watchGuide();
      expect((await stream.first).heroTitle, 'Updated guide');
      await repository.dispose();
    },
  );
}
