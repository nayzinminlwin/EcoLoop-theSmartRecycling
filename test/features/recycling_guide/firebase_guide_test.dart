import 'package:eco_loop/features/recycling_guide/data/firebase_recycling_guide_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'active policy derives deduplicated rates from canonical classes',
    () async {
      final repository = FirebaseRecyclingGuideRepository(
        reads: _Reads({
          'policyPointers/active': {'policyId': 'policy-modern'},
          'policies/policy-modern': {
            'acceptedObjectClasses': [
              'plastic_bottle',
              'aluminium_can',
              'paper_item',
              'paper_bag',
              'glass_bottle',
            ],
            'rewardCategoryByClass': {
              'plastic_bottle': 'plastic',
              'aluminium_can': 'aluminium',
              'paper_item': 'paper',
              'paper_bag': 'paper',
              'cardboard_item': 'paper',
              'glass_bottle': 'glass',
            },
            'pointsPerItemByCategory': {
              'plastic': 5,
              'aluminium': 8,
              'paper': 3,
              'glass': 10,
            },
          },
          'guideContent/policy-modern': {
            'id': 'guide-policy-modern',
            'heroTitle': 'Current policy',
            'heroDescription': 'Current rates',
            'toDo': [],
            'toAvoid': [],
            'pointsDisclaimer': 'Rates can change.',
            'rateExamples': [
              {'materialType': 'glass', 'itemCount': 2},
            ],
          },
          'guideMaterials/policy-modern': {
            'items': [
              {
                'id': 'glass',
                'type': 'glass',
                'canonicalClass': 'glass_bottle',
                'title': 'Glass bottles',
                'preparationTip': 'Rinse',
                'iconKey': 'recycle',
                'sortOrder': 1,
              },
              {
                'id': 'cardboard',
                'type': 'paper',
                'canonicalClass': 'cardboard_item',
                'title': 'Cardboard',
                'preparationTip': 'Flatten',
                'iconKey': 'book',
                'sortOrder': 2,
              },
            ],
          },
          'guideSteps/policy-modern': {
            'items': [
              {'id': 'scan', 'order': 1, 'instruction': 'Scan the bin'},
            ],
          },
        }),
      );

      final guide = await repository.getGuide();

      expect(guide.rates.map((rate) => rate.displayName), [
        'Plastic',
        'Aluminium',
        'Paper',
        'Glass',
      ]);
      expect(guide.rates, hasLength(4));
      expect(guide.rates.last.pointsFor(2), 20);
      expect(guide.materials.map((material) => material.title), [
        'Glass bottles',
      ]);
      expect(guide.materials.single.canonicalClass, 'glass_bottle');
    },
  );

  test(
    'active policy keeps cardboard excluded from the current guide rates',
    () async {
      final repository = FirebaseRecyclingGuideRepository(
        reads: _Reads({
          'policyPointers/active': {'policyId': 'policy-2'},
          'policies/policy-2': {
            'acceptedClasses': ['plastic_bottle', 'aluminium_can', 'paper_bag'],
            'rates': [
              {
                'class': 'plastic_bottle',
                'materialType': 'plastic',
                'displayName': 'Plastic',
                'pointsPerItem': 5,
                'eligible': true,
              },
              {
                'class': 'paper_item',
                'materialType': 'paper',
                'displayName': 'Paper',
                'pointsPerItem': 3,
                'eligible': true,
              },
              {
                'class': 'cardboard_item',
                'materialType': 'paper',
                'displayName': 'Cardboard',
                'pointsPerItem': 0,
                'eligible': false,
              },
            ],
          },
          'guideContent/policy-2': {
            'id': 'guide-policy-2',
            'heroTitle': 'Current policy',
            'heroDescription': 'Current rates',
            'toDo': ['Empty containers'],
            'toAvoid': ['Cardboard'],
            'pointsDisclaimer': 'Rates can change.',
          },
          'guideMaterials/policy-2': {
            'items': [
              {
                'id': 'plastic',
                'type': 'plastic',
                'title': 'Plastic bottles',
                'preparationTip': 'Rinse',
                'iconKey': 'recycle',
                'sortOrder': 1,
              },
              {
                'id': 'paper',
                'type': 'paper',
                'title': 'Paper & cardboard',
                'preparationTip': 'Flatten',
                'iconKey': 'book',
                'sortOrder': 2,
              },
            ],
          },
          'guideSteps/policy-2': {
            'items': [
              {'id': 'scan', 'order': 1, 'instruction': 'Scan the bin'},
            ],
          },
        }),
      );

      final guide = await repository.getGuide();

      expect(guide.id, 'policy-2');
      expect(
        guide.rates.firstWhere((rate) => rate.displayName == 'Paper').eligible,
        isFalse,
      );
      expect(
        guide.rates
            .firstWhere((rate) => rate.displayName == 'Plastic')
            .eligible,
        isTrue,
      );
    },
  );
}

class _Reads implements GuideReadTransport {
  _Reads(this.values);
  final Map<String, Map<String, Object?>> values;
  @override
  Future<Map<String, Object?>?> read(String collection, String id) async =>
      values['$collection/$id'];
  @override
  Stream<Map<String, Object?>> watch(String collection, String id) =>
      Stream.value(values['$collection/$id']!);
}
