import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:eco_loop/core/data/json_readers.dart';
import 'package:eco_loop/core/firebase/command_client.dart';
import 'package:eco_loop/features/wallet/domain/models/wallet_snapshot.dart';

import '../domain/models/reward.dart';
import '../domain/models/reward_category.dart';
import '../domain/models/reward_redemption.dart';
import '../domain/models/resident_voucher.dart';
import '../domain/repositories/rewards_repository.dart';

abstract interface class RewardsReadTransport {
  Future<List<JsonMap>> readCollection(String collection);
  Future<List<JsonMap>> readOwnerVouchers(String uid);
  Future<JsonMap?> readDocument(String collection, String id);
  Stream<List<JsonMap>> watchCollection(String collection);
  Stream<List<JsonMap>> watchOwnerVouchers(String uid);
  Stream<JsonMap?> watchDocument(String collection, String id);
}

abstract interface class VoucherPageReadTransport {
  Future<List<JsonMap>> readVoucherPage({
    required String uid,
    required int limit,
    VoucherCursor? cursor,
  });
}

class FirestoreRewardsReadTransport
    implements RewardsReadTransport, VoucherPageReadTransport {
  const FirestoreRewardsReadTransport(this.firestore);

  final FirebaseFirestore firestore;

  @override
  Future<List<JsonMap>> readCollection(String collection) async =>
      (await firestore.collection(collection).get()).docs
          .map((doc) => <String, Object?>{'id': doc.id, ...doc.data()})
          .toList(growable: false);

  @override
  Future<List<JsonMap>> readOwnerVouchers(String uid) async =>
      (await firestore
              .collection('vouchers')
              .where('residentId', isEqualTo: uid)
              .get())
          .docs
          .map((doc) => <String, Object?>{'id': doc.id, ...doc.data()})
          .toList(growable: false);

  @override
  Future<JsonMap?> readDocument(String collection, String id) async {
    final snapshot = await firestore.collection(collection).doc(id).get();
    final data = snapshot.data();
    return data == null ? null : <String, Object?>{'id': snapshot.id, ...data};
  }

  @override
  Stream<List<JsonMap>> watchCollection(String collection) => firestore
      .collection(collection)
      .snapshots()
      .map(
        (snapshot) => snapshot.docs
            .map((doc) => <String, Object?>{'id': doc.id, ...doc.data()})
            .toList(growable: false),
      );

  @override
  Stream<List<JsonMap>> watchOwnerVouchers(String uid) => firestore
      .collection('vouchers')
      .where('residentId', isEqualTo: uid)
      .snapshots()
      .map(
        (snapshot) => snapshot.docs
            .map((doc) => <String, Object?>{'id': doc.id, ...doc.data()})
            .toList(growable: false),
      );

  @override
  Stream<JsonMap?> watchDocument(String collection, String id) =>
      firestore.collection(collection).doc(id).snapshots().map((snapshot) {
        final data = snapshot.data();
        return data == null
            ? null
            : <String, Object?>{'id': snapshot.id, ...data};
      });

  @override
  Future<List<JsonMap>> readVoucherPage({
    required String uid,
    required int limit,
    VoucherCursor? cursor,
  }) async {
    var query = firestore
        .collection('vouchers')
        .where('residentId', isEqualTo: uid)
        .orderBy('issuedAt', descending: true)
        .orderBy(FieldPath.documentId, descending: true)
        .limit(limit);
    if (cursor != null) {
      query = query.startAfter([
        Timestamp.fromDate(cursor.issuedAt),
        cursor.id,
      ]);
    }
    final snapshot = await query.get();
    return snapshot.docs
        .map((doc) => <String, Object?>{'id': doc.id, ...doc.data()})
        .toList(growable: false);
  }
}

class FirebaseRewardsRepository implements RewardsRepository {
  FirebaseRewardsRepository({
    required this.uid,
    required this.commandClient,
    DateTime Function()? now,
    FirebaseFirestore? firestore,
    RewardsReadTransport? reads,
  }) : _reads =
           reads ??
           FirestoreRewardsReadTransport(
             firestore ?? FirebaseFirestore.instance,
           ),
       _now = now ?? DateTime.now;

  final String uid;
  final CommandClient commandClient;
  final RewardsReadTransport _reads;
  final DateTime Function() _now;

  @override
  Future<List<RewardCategory>> getCategories() async =>
      (await _reads.readCollection('rewardCategories'))
          .map(RewardCategory.fromJson)
          .toList(growable: false);

  @override
  Future<List<Reward>> getRewards(String? categoryId) async {
    final rewards = (await _reads.readCollection('rewards'))
        .map((item) => _mapReward(item, 0))
        .where(
          (reward) => categoryId == null || reward.categoryId == categoryId,
        )
        .toList();
    return _withResidentCounts(rewards);
  }

  @override
  Future<Reward> getReward(String rewardId) async {
    final data = await _reads.readDocument('rewards', rewardId);
    if (data == null) throw StateError('Reward $rewardId does not exist');
    return (await _withResidentCounts([_mapReward(data, 0)])).single;
  }

  @override
  Future<RewardRedemptionReceipt> redeemReward(
    String rewardId,
    String idempotencyKey, {
    String? offerVersion,
    int? displayedCost,
  }) async {
    final displayedOffer = offerVersion != null && displayedCost != null
        ? null
        : await getReward(rewardId);
    final envelope = await commandClient.execute('redeemReward', {
      'rewardId': rewardId,
      'offerVersion': offerVersion ?? displayedOffer!.offerVersion,
      'displayedCost': displayedCost ?? displayedOffer!.pointsCost,
    }, requestId: idempotencyKey);
    final data = envelope.data!;
    final redeemedAt = data['redeemedAt'] == null
        ? DateTime.now().toUtc()
        : JsonReaders.dateTime(data, 'redeemedAt');
    final issuedAt = data['issuedAt'] == null
        ? redeemedAt
        : JsonReaders.dateTime(data, 'issuedAt');
    final expiresAt = JsonReaders.dateTime(data, 'expiresAt');
    final voucher = ResidentVoucher(
      id: JsonReaders.string(data, 'voucherId'),
      residentId: uid,
      rewardId: rewardId,
      title: JsonReaders.string(data, 'title'),
      merchantName: JsonReaders.string(data, 'merchant'),
      code: JsonReaders.string(data, 'voucherCode'),
      terms: JsonReaders.string(data, 'terms'),
      issuedAt: issuedAt,
      expiresAt: expiresAt,
      status: VoucherStatus.available,
      remainingUses: 1,
      usedAt: null,
    );
    final balance = JsonReaders.integer(data, 'balance');
    final cost = JsonReaders.integer(data, 'cost');
    final redemption = RewardRedemption(
      id: JsonReaders.string(data, 'redemptionId'),
      residentId: uid,
      rewardId: rewardId,
      idempotencyKey: idempotencyKey,
      pointsSpent: cost,
      redeemedAt: redeemedAt,
      voucherId: voucher.id,
      walletBalanceAfter: balance,
      walletVersion: JsonReaders.integer(data, 'walletVersion'),
    );
    return RewardRedemptionReceipt(
      redemption: redemption,
      voucher: voucher,
      wallet: WalletSnapshot(
        residentId: uid,
        balance: balance,
        nextRewardCost: null,
        updatedAt: redeemedAt,
        version: JsonReaders.integer(data, 'walletVersion'),
      ),
    );
  }

  @override
  Future<ResidentVoucher> useDemoVoucher(
    String voucherId,
    String idempotencyKey,
  ) async {
    final envelope = await commandClient.execute('useResidentDemoVoucher', {
      'voucherId': voucherId,
    }, requestId: idempotencyKey);
    final current = await getVoucher(voucherId);
    final usedAt = JsonReaders.dateTime(envelope.data!, 'usedAt');
    return ResidentVoucher(
      id: current.id,
      residentId: current.residentId,
      rewardId: current.rewardId,
      title: current.title,
      merchantName: current.merchantName,
      code: current.code,
      terms: current.terms,
      issuedAt: current.issuedAt,
      expiresAt: current.expiresAt,
      status: VoucherStatus.used,
      remainingUses: 0,
      usedAt: usedAt,
      demo: current.demo,
      offerVersion: current.offerVersion,
    );
  }

  @override
  Future<List<ResidentVoucher>> getVouchers(VoucherStatus? status) async {
    final items = (await _reads.readOwnerVouchers(uid))
        .map(ResidentVoucher.fromJson)
        .where((item) => status == null || item.statusAt(_now()) == status)
        .toList();
    return items..sort((a, b) => b.issuedAt.compareTo(a.issuedAt));
  }

  @override
  Future<ResidentVoucher> getVoucher(String voucherId) async {
    final data = await _reads.readDocument('vouchers', voucherId);
    if (data == null || data['residentId'] != uid) {
      throw StateError('Voucher $voucherId does not exist');
    }
    return ResidentVoucher.fromJson(data);
  }

  @override
  Future<VoucherPage> getVouchersPage(
    VoucherStatus? status, {
    VoucherCursor? cursor,
    int limit = 25,
  }) async {
    final raw = _reads is VoucherPageReadTransport
        ? await (_reads as VoucherPageReadTransport).readVoucherPage(
            uid: uid,
            limit: limit,
            cursor: cursor,
          )
        : (await getVouchers(status)).map((item) => item.toJson()).toList();
    final items = raw
        .map(ResidentVoucher.fromJson)
        .where((item) => status == null || item.statusAt(_now()) == status)
        .toList(growable: false);
    return VoucherPage(
      items: items,
      nextCursor: raw.length == limit && raw.isNotEmpty
          ? VoucherCursor(
              issuedAt: JsonReaders.dateTime(raw.last, 'issuedAt'),
              id: JsonReaders.string(raw.last, 'id'),
            )
          : null,
    );
  }

  @override
  Stream<List<RewardCategory>> watchCategories() => _reads
      .watchCollection('rewardCategories')
      .map(
        (items) => items.map(RewardCategory.fromJson).toList(growable: false),
      );

  @override
  Stream<List<Reward>> watchRewards({String? categoryId}) =>
      _reads.watchCollection('rewards').asyncMap((items) async {
        final rewards = items
            .map((item) => _mapReward(item, 0))
            .where(
              (reward) => categoryId == null || reward.categoryId == categoryId,
            )
            .toList();
        return _withResidentCounts(rewards);
      });

  @override
  Stream<Reward?> watchReward(String rewardId) =>
      _reads.watchDocument('rewards', rewardId).asyncMap((data) async {
        if (data == null) return null;
        return (await _withResidentCounts([_mapReward(data, 0)])).single;
      });

  @override
  Stream<List<ResidentVoucher>> watchVouchers({VoucherStatus? status}) => _reads
      .watchOwnerVouchers(uid)
      .map(
        (items) => items
            .map(ResidentVoucher.fromJson)
            .where((item) => status == null || item.statusAt(_now()) == status)
            .toList(growable: false),
      );

  @override
  Stream<ResidentVoucher?> watchVoucher(String voucherId) =>
      _reads.watchDocument('vouchers', voucherId).map((data) {
        if (data == null || data['residentId'] != uid) return null;
        return ResidentVoucher.fromJson(data);
      });

  Reward _mapReward(JsonMap data, int residentRedemptionCount) {
    final catalogExpiry = data['catalogExpiresAt'] ?? data['expiresAt'];
    return Reward.fromJson({
      ...data,
      'merchantName': data['merchantName'] ?? data['merchant'],
      'description': data['description'] ?? '',
      'expiresAt': catalogExpiry,
      'tag': data['tag'],
      'imageUrl': data['imageUrl'],
      'artKey': data['artKey'] ?? 'gift',
      'sortOrder': data['sortOrder'] ?? 0,
      'residentRedemptionCount': residentRedemptionCount,
    });
  }

  Future<List<Reward>> _withResidentCounts(List<Reward> rewards) async {
    final vouchers = await getVouchers(null);
    final counts = <String, int>{};
    for (final voucher in vouchers) {
      if (voucher.rewardId != null) {
        counts.update(
          voucher.rewardId!,
          (value) => value + 1,
          ifAbsent: () => 1,
        );
      }
    }
    return rewards
        .map(
          (reward) => Reward.fromJson({
            ...reward.toJson(),
            'residentRedemptionCount': counts[reward.id] ?? 0,
          }),
        )
        .toList(growable: false);
  }
}
