import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:eco_loop/core/data/json_readers.dart';

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
  Stream<RecyclingGuide> watchGuide() async* {
    final pointer = await _required('policyPointers', 'active');
    final policyId = JsonReaders.string(pointer, 'policyId');
    final content = await _required('guideContent', policyId);
    final materials = await _readList('guideMaterials', policyId);
    final steps = await _readList('guideSteps', policyId);
    await for (final policy in _reads.watch('policies', policyId)) {
      yield _compose(policyId, policy, content, materials, steps);
    }
  }

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
    final accepted =
        (policy['acceptedClasses'] as List?)?.whereType<String>().toSet() ??
        const <String>{};
    final rates =
        (policy['rates'] as List?)
            ?.map((item) => Map<String, Object?>.from(item as Map))
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
    final guideContent = RecyclingGuideContent.fromJson(content);
    final parsedMaterials = materials
        .map(RecyclingMaterial.fromJson)
        .where(
          (material) =>
              accepted.contains('${material.type.wireValue}_bottle') ||
              accepted.contains('${material.type.wireValue}_can') ||
              accepted.contains('${material.type.wireValue}_item') ||
              accepted.contains(material.type.wireValue),
        )
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
}
