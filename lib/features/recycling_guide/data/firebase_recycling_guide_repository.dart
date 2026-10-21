import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:eco_loop/core/data/json_readers.dart';
import 'package:eco_loop/core/domain/material_type.dart';

import '../domain/models/material_rate.dart';
import '../domain/models/recycling_guide.dart';
import '../domain/models/recycling_guide_content.dart';
import '../domain/models/recycling_material.dart';
import '../domain/models/recycling_step.dart';
import '../domain/repositories/recycling_guide_repository.dart';

abstract interface class GuideReadTransport {
  Future<Map<String, Object?>?> read(String collection, String id);
  Stream<Map<String, Object?>> watch(String collection, String id);
}

class FirestoreGuideReadTransport implements GuideReadTransport {
  const FirestoreGuideReadTransport(this.firestore);

  final FirebaseFirestore firestore;

  @override
  Future<Map<String, Object?>?> read(String collection, String id) async {
    final snapshot = await firestore.collection(collection).doc(id).get();
    final data = snapshot.data();
    return data == null ? null : Map<String, Object?>.from(data);
  }

  @override
  Stream<Map<String, Object?>> watch(String collection, String id) =>
      firestore.collection(collection).doc(id).snapshots().map((snapshot) {
        final data = snapshot.data();
        if (data == null) throw StateError('$collection/$id does not exist');
        return Map<String, Object?>.from(data);
      });
}

class FirebaseRecyclingGuideRepository implements RecyclingGuideRepository {
  FirebaseRecyclingGuideRepository({
    FirebaseFirestore? firestore,
    GuideReadTransport? reads,
  }) : _reads =
           reads ??
           FirestoreGuideReadTransport(firestore ?? FirebaseFirestore.instance);

  final GuideReadTransport _reads;

  @override
  Future<RecyclingGuide> getGuide() async {
    final pointer = await _required('policyPointers', 'active');
    final policyId = JsonReaders.string(pointer, 'policyId');
    return _compose(
      policyId,
      await _required('policies', policyId),
      await _required('guideContent', policyId),
      await _readList('guideMaterials', policyId),
      await _readList('guideSteps', policyId),
    );
  }

  @override
  Stream<RecyclingGuide> watchGuide() => Stream.multi((controller) {
    StreamSubscription<Map<String, Object?>>? pointerSubscription;
    StreamSubscription<Map<String, Object?>>? policySubscription;
    var generation = 0;

    Future<void> subscribeToPolicy(String policyId) async {
      final currentGeneration = ++generation;
      final content = await _required('guideContent', policyId);
      final materials = await _readList('guideMaterials', policyId);
      final steps = await _readList('guideSteps', policyId);
      await policySubscription?.cancel();
      if (controller.isClosed || currentGeneration != generation) return;
      policySubscription = _reads.watch('policies', policyId).listen((policy) {
        if (!controller.isClosed && currentGeneration == generation) {
          controller.add(_compose(policyId, policy, content, materials, steps));
        }
      }, onError: controller.addError);
    }

    pointerSubscription = _reads.watch('policyPointers', 'active').listen((
      pointer,
    ) {
      final policyId = JsonReaders.string(pointer, 'policyId');
      subscribeToPolicy(policyId).catchError(controller.addError);
    }, onError: controller.addError);
    controller.onCancel = () async {
      await pointerSubscription?.cancel();
      await policySubscription?.cancel();
    };
  });

  Future<Map<String, Object?>> _required(String collection, String id) async {
    final value = await _reads.read(collection, id);
    if (value == null) throw StateError('$collection/$id does not exist');
    return value;
  }

  Future<List<Map<String, Object?>>> _readList(
    String collection,
    String policyId,
  ) async {
    final value = await _reads.read(collection, policyId);
    if (value == null) return const [];
    final items = value['items'];
    if (items is! List) return const [];
    return items
        .map((item) => Map<String, Object?>.from(item as Map))
        .toList(growable: false);
  }

  RecyclingGuide _compose(
    String policyId,
    Map<String, Object?> policy,
    Map<String, Object?> content,
    List<Map<String, Object?>> materials,
    List<Map<String, Object?>> steps,
  ) {
    final policyData = _policyData(policy);
    final accepted = policyData.acceptedClasses;
    final rates = policyData.rates;
    final guideContent = RecyclingGuideContent.fromJson(content);
    final parsedMaterials = materials
        .map(RecyclingMaterial.fromJson)
        .where((material) => _isAcceptedMaterial(material, accepted))
        .toList(growable: false);
    return RecyclingGuide.compose(
      content: RecyclingGuideContent(
        heroTitle: guideContent.heroTitle,
        heroDescription: guideContent.heroDescription,
        toDo: guideContent.toDo,
        toAvoid: guideContent.toAvoid,
        pointsDisclaimer: guideContent.pointsDisclaimer,
        rateExamples: guideContent.rateExamples,
        id: policyId,
      ),
      materials: parsedMaterials,
      steps: steps.map(RecyclingStep.fromJson).toList(growable: false),
      rates: rates,
    );
  }

  _PolicyData _policyData(Map<String, Object?> policy) {
    final hasCategoryContract =
        policy.containsKey('acceptedObjectClasses') ||
        policy.containsKey('rewardCategoryByClass') ||
        policy.containsKey('pointsPerItemByCategory');
    if (hasCategoryContract) {
      final acceptedClasses = _stringSet(policy, 'acceptedObjectClasses');
      final categoryByClass = JsonReaders.map(
        policy['rewardCategoryByClass'],
        'rewardCategoryByClass',
      );
      final pointsByCategory = JsonReaders.map(
        policy['pointsPerItemByCategory'],
        'pointsPerItemByCategory',
      );
      final categories = <String>[];
      for (final canonicalClass in acceptedClasses) {
        final category = categoryByClass[canonicalClass];
        if (category is String &&
            category.isNotEmpty &&
            !categories.contains(category)) {
          categories.add(category);
        }
      }
      categories.sort((left, right) {
        final leftIndex = _categoryOrder.indexOf(left);
        final rightIndex = _categoryOrder.indexOf(right);
        if (leftIndex == -1 && rightIndex == -1) return left.compareTo(right);
        if (leftIndex == -1) return 1;
        if (rightIndex == -1) return -1;
        return leftIndex.compareTo(rightIndex);
      });
      final rates = categories
          .map((category) {
            final points = pointsByCategory[category];
            if (points is! num ||
                points != points.roundToDouble() ||
                points < 0) {
              throw JsonReaders.invalid('pointsPerItemByCategory.$category');
            }
            return MaterialRate(
              materialType: MaterialType.fromWire(category),
              displayName: _displayName(category),
              pointsPerItem: points.toInt(),
              eligible: true,
            );
          })
          .where((rate) => rate.materialType != MaterialType.unknown)
          .toList(growable: false);
      return _PolicyData(acceptedClasses: acceptedClasses, rates: rates);
    }

    final accepted = _stringSet(policy, 'acceptedClasses');
    final rates =
        (policy['rates'] as List?)
            ?.map((item) => JsonReaders.map(item, 'rates'))
            .map(
              (item) => MaterialRate(
                materialType: MaterialRate.fromJson(item).materialType,
                displayName: JsonReaders.string(item, 'displayName'),
                pointsPerItem: JsonReaders.integer(item, 'pointsPerItem'),
                eligible: accepted.contains(JsonReaders.string(item, 'class')),
              ),
            )
            .toList(growable: false) ??
        const <MaterialRate>[];
    return _PolicyData(acceptedClasses: accepted, rates: rates);
  }

  Set<String> _stringSet(Map<String, Object?> json, String field) {
    final value = json[field];
    if (value is List && value.every((item) => item is String)) {
      return value.cast<String>().toSet();
    }
    throw JsonReaders.invalid(field);
  }

  bool _isAcceptedMaterial(
    RecyclingMaterial material,
    Set<String> acceptedClasses,
  ) {
    final canonicalClass = material.canonicalClass;
    if (canonicalClass != null) return acceptedClasses.contains(canonicalClass);
    final candidates = switch (material.type) {
      MaterialType.plastic => const ['plastic_bottle'],
      MaterialType.aluminium => const ['aluminium_can'],
      MaterialType.glass => const ['glass_bottle'],
      MaterialType.paper => const ['paper_item', 'paper_bag'],
      MaterialType.unknown => const <String>[],
    };
    return candidates.any(acceptedClasses.contains);
  }

  String _displayName(String category) => category.isEmpty
      ? category
      : '${category[0].toUpperCase()}${category.substring(1)}';

  static const _categoryOrder = ['plastic', 'aluminium', 'paper', 'glass'];
}

class _PolicyData {
  const _PolicyData({required this.acceptedClasses, required this.rates});

  final Set<String> acceptedClasses;
  final List<MaterialRate> rates;
}
