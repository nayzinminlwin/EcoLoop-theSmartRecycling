import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:eco_loop/core/domain/material_type.dart';
import 'package:eco_loop/core/domain/material_weight_constants.dart';
import 'package:eco_loop/core/firebase/firebase_converters.dart';

import '../domain/models/deposit_filter.dart';
import '../domain/models/deposit_transaction.dart';
import '../domain/models/recycling_summary.dart';
import '../domain/repositories/activity_repository.dart';

abstract interface class ActivityReadTransport {
  Future<ActivityRawPage> readPage({
    required String uid,
    required DepositFilter filter,
    required int limit,
    ActivityCursor? after,
  });
  Stream<ActivityRawPage> watchPage({
    required String uid,
    required DepositFilter filter,
    required int limit,
  });
}

class ActivityRawPage {
  const ActivityRawPage({required this.rows, this.nextCursor});

  final List<Map<String, Object?>> rows;
  final ActivityCursor? nextCursor;
}

class FirestoreActivityReadTransport implements ActivityReadTransport {
  const FirestoreActivityReadTransport(this.firestore);

  final FirebaseFirestore firestore;

  Query<Map<String, dynamic>> _query(
    String uid,
    DepositFilter filter,
    ActivityCursor? after,
  ) {
    filter.validate();
    Query<Map<String, dynamic>> query = firestore
        .collection('deposits')
        .where('ownerId', isEqualTo: uid);
    if (filter.status != null) {
      query = query.where('status', isEqualTo: filter.status!.wireValue);
    }
    if (filter.from != null) {
      query = query.where(
        'updatedAt',
        isGreaterThanOrEqualTo: Timestamp.fromDate(filter.from!),
      );
    }
    if (filter.toExclusive != null) {
      query = query.where(
        'updatedAt',
        isLessThan: Timestamp.fromDate(filter.toExclusive!),
      );
    }
    query = query
        .orderBy('updatedAt', descending: true)
        .orderBy(FieldPath.documentId, descending: true);
    if (after != null) {
      query = query.startAfter([
        Timestamp.fromDate(after.occurredAt),
        after.id,
      ]);
    }
    return query;
  }

  @override
  Future<ActivityRawPage> readPage({
    required String uid,
    required DepositFilter filter,
    required int limit,
    ActivityCursor? after,
  }) async {
    final snapshot = await _query(uid, filter, after).limit(limit).get();
    return _page(snapshot.docs);
  }

  @override
  Stream<ActivityRawPage> watchPage({
    required String uid,
    required DepositFilter filter,
    required int limit,
  }) => _query(
    uid,
    filter,
    null,
  ).limit(limit).snapshots().map((snapshot) => _page(snapshot.docs));

  ActivityRawPage _page(
    List<QueryDocumentSnapshot<Map<String, dynamic>>> docs,
  ) {
    final rows = docs
        .map(
          (doc) => <String, Object?>{
            ...Map<String, Object?>.from(doc.data()),
            'id': doc.id,
          },
        )
        .toList(growable: false);
    return ActivityRawPage(
      rows: rows,
      nextCursor: docs.isEmpty
          ? null
          : ActivityCursor(
              occurredAt: firestoreRequiredDate(
                docs.last.data()['updatedAt'],
                'updatedAt',
              ),
              id: docs.last.id,
            ),
    );
  }
}

class FirebaseActivityRepository implements ActivityRepository {
  FirebaseActivityRepository({
    required this.uid,
    FirebaseFirestore? firestore,
    ActivityReadTransport? reads,
    StatsReadTransport? stats,
  }) : _reads =
           reads ??
           FirestoreActivityReadTransport(
             firestore ?? FirebaseFirestore.instance,
           ),
       _stats = stats, // ignore: prefer_initializing_formals
       _firestore = firestore;

  final String uid;
  final ActivityReadTransport _reads;
  final StatsReadTransport? _stats;
  final FirebaseFirestore? _firestore;

  StatsReadTransport get _statsTransport =>
      _stats ??
      FirebaseStatsReadTransport(_firestore ?? FirebaseFirestore.instance);

  @override
  Future<List<DepositTransaction>> getDeposits({
    required DepositFilter filter,
    int? limit,
  }) async => (await getDepositsPage(filter: filter, limit: limit)).items;

  @override
  Future<ActivityPage> getDepositsPage({
    required DepositFilter filter,
    int? limit,
    ActivityCursor? after,
  }) async {
    final page = await _reads.readPage(
      uid: uid,
      filter: filter,
      limit: limit ?? 25,
      after: after,
    );
    return _mapPage(page);
  }

  @override
  Stream<List<DepositTransaction>> watchDeposits({
    required DepositFilter filter,
    int? limit,
  }) =>
      watchDepositsPage(filter: filter, limit: limit).map((page) => page.items);

  @override
  Stream<ActivityPage> watchDepositsPage({
    required DepositFilter filter,
    int? limit,
    ActivityCursor? after,
  }) {
    final seen = <String, DepositTransaction>{};
    return _reads.watchPage(uid: uid, filter: filter, limit: limit ?? 25).map((
      page,
    ) {
      for (final item in page.rows.map(DepositTransaction.fromBackendJson)) {
        final previous = seen[item.id];
        if (previous == null ||
            item.decisionVersion >= previous.decisionVersion) {
          seen[item.id] = item;
        }
      }
      final items = seen.values.toList()
        ..sort((a, b) {
          final date = b.occurredAt.compareTo(a.occurredAt);
          return date == 0 ? b.id.compareTo(a.id) : date;
        });
      return ActivityPage(items: items, nextCursor: page.nextCursor);
    });
  }

  @override
  Future<RecyclingSummary> getSummary() async {
    final data = await _statsTransport.read(uid);
    if (data == null) {
      throw StateError('Resident stats $uid does not exist');
    }
    return _summaryFromStats(Map<String, Object?>.from(data));
  }

  @override
  Stream<RecyclingSummary> watchSummary() =>
      _statsTransport.watch(uid).map((data) {
        return _summaryFromStats(Map<String, Object?>.from(data));
      });

  RecyclingSummary _summaryFromStats(Map<String, Object?> data) {
    final rawCounts = data['acceptedItemCounts'];
    final counts = <MaterialType, int>{};
    if (rawCounts is Map) {
      for (final entry in rawCounts.entries) {
        if (entry.value is num) {
          counts[MaterialType.fromWire(entry.key.toString())] =
              (entry.value as num).toInt();
        }
      }
    }
    return RecyclingSummary(
      verifiedDepositCount: (data['verifiedBatchCount'] as num?)?.toInt() ?? 0,
      verifiedWeightKg: counts.entries.fold<double>(
        0,
        (total, entry) =>
            total + MaterialWeightConstants.getWeightKg(entry.key, entry.value),
      ),
      acceptedItemCounts: counts,
    );
  }

  ActivityPage _mapPage(ActivityRawPage page) => ActivityPage(
    items: page.rows
        .map(DepositTransaction.fromBackendJson)
        .toList(growable: false),
    nextCursor: page.nextCursor,
  );
}

abstract interface class StatsReadTransport {
  Future<Map<String, Object?>?> read(String uid);
  Stream<Map<String, Object?>> watch(String uid);
}

class FirebaseStatsReadTransport implements StatsReadTransport {
  FirebaseStatsReadTransport(this.firestore);

  final FirebaseFirestore firestore;

  @override
  Future<Map<String, Object?>?> read(String uid) async {
    final snapshot = await firestore.doc('residents/$uid/stats/current').get();
    final data = snapshot.data();
    return data == null ? null : Map<String, Object?>.from(data);
  }

  @override
  Stream<Map<String, Object?>> watch(String uid) => firestore
      .doc('residents/$uid/stats/current')
      .snapshots()
      .map((snapshot) {
        final data = snapshot.data();
        if (data == null) {
          throw StateError('Resident stats $uid does not exist');
        }
        return Map<String, Object?>.from(data);
      });
}
