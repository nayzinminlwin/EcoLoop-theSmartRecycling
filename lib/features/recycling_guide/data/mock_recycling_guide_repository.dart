import 'dart:async';

import 'package:eco_loop/core/data/json_readers.dart';
import 'package:eco_loop/core/domain/material_type.dart';
import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/core/mock/mock_seed_loader.dart';

import '../domain/models/material_rate.dart';
import '../domain/models/recycling_guide.dart';
import '../domain/models/recycling_guide_content.dart';
import '../domain/models/recycling_material.dart';
import '../domain/models/recycling_step.dart';
import '../domain/repositories/recycling_guide_repository.dart';

class MockRecyclingGuideRepository implements RecyclingGuideRepository {
  MockRecyclingGuideRepository({MockSeedLoader? seedLoader, MockApi? api})
    : _seedLoader = seedLoader ?? const MockSeedLoader(),
      _api = api ?? MockApi();

  final MockSeedLoader _seedLoader;
  final MockApi _api;
  final StreamController<RecyclingGuide> _updates =
      StreamController<RecyclingGuide>.broadcast();
  RecyclingGuide? _latestGuide;
  Future<RecyclingGuide> _read() async {
    final envelope = await _seedLoader.loadMap(
      'assets/mock/recycling_guide/guide.json',
    );
    final content = RecyclingGuideContent.fromJson(
      JsonReaders.map(envelope['content'], 'content'),
    );
    final materials = envelope['materials'] is List
        ? ((envelope['materials'] as List)
              .map(
                (item) => RecyclingMaterial.fromJson(
                  JsonReaders.map(item, 'materials'),
                ),
              )
              .toList()
            ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder)))
        : <RecyclingMaterial>[];
    final displayMaterials = _combinePaperMaterials(materials);
    final steps = envelope['steps'] is List
        ? ((envelope['steps'] as List)
              .map(
                (item) =>
                    RecyclingStep.fromJson(JsonReaders.map(item, 'steps')),
              )
              .toList()
            ..sort((a, b) => a.order.compareTo(b.order)))
        : <RecyclingStep>[];
    final rates = envelope['rates'] is List
        ? (envelope['rates'] as List)
              .map(
                (item) => MaterialRate.fromJson(JsonReaders.map(item, 'rates')),
              )
              .toList()
        : <MaterialRate>[];
    final guide = RecyclingGuide.compose(
      content: content,
      materials: displayMaterials,
      steps: steps,
      rates: rates,
      rateExamples: content.rateExamples,
    );
    return guide;
  }

  List<RecyclingMaterial> _combinePaperMaterials(
    List<RecyclingMaterial> materials,
  ) {
    final paperMaterials = materials
        .where(
          (material) =>
              material.canonicalClass == 'paper_item' ||
              material.canonicalClass == 'paper_bag' ||
              material.id == 'paper-items' ||
              material.id == 'paper-bags',
        )
        .toList();
    if (paperMaterials.length < 2) return List.unmodifiable(materials);

    final firstPaperIndex = materials.indexOf(paperMaterials.first);
    final combined = RecyclingMaterial(
      id: 'paper-items-and-bags',
      type: MaterialType.paper,
      title: 'Paper items & bags',
      preparationTip: paperMaterials
          .map((material) => material.preparationTip)
          .toSet()
          .join(' '),
      iconKey: paperMaterials.first.iconKey,
      sortOrder: paperMaterials.first.sortOrder,
    );
    return List.unmodifiable([
      for (var index = 0; index < materials.length; index++) ...[
        if (index == firstPaperIndex) combined,
        if (!paperMaterials.contains(materials[index])) materials[index],
      ],
    ]);
  }

  @override
  Future<RecyclingGuide> getGuide() async {
    return _api.read(
      'recyclingGuide.getGuide',
      () async => _latestGuide ??= await _read(),
    );
  }

  @override
  Stream<RecyclingGuide> watchGuide() async* {
    final initial = await getGuide();
    yield initial;
    yield* _updates.stream;
  }

  Future<void> updateGuide(RecyclingGuide guide) async {
    await _api.write('recyclingGuide.updateGuide', () {
      _latestGuide = guide;
      _updates.add(guide);
    });
  }

  Future<void> dispose() => _updates.close();
}
