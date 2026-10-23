import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:eco_loop/core/data/json_readers.dart';
import 'package:eco_loop/core/data/pending_operation_store.dart';
import 'package:eco_loop/core/firebase/command_client.dart';
import 'package:eco_loop/features/rewards/data/firebase_rewards_repository.dart';
import 'package:eco_loop/features/rewards/domain/models/reward_category.dart';
import 'package:eco_loop/features/rewards/domain/models/resident_voucher.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('maps seeded category displayName', () {
    final category = RewardCategory.fromJson({
      'id': 'food',
      'displayName': 'Food & drink',
      'sortOrder': 1,
    });
    expect(category.label, 'Food & drink');
  });

  test('maps seeded reward merchant and SDK catalog timestamp', () async {
    final repository = FirebaseRewardsRepository(
      uid: 'resident-owner',
      reads: _SeedReads(),
      commandClient: CommandClient(
        uid: 'resident-owner',
        store: PendingOperationStore(preferences: _MemoryPreferences()),
        transport: (operation, payload) async => <String, Object?>{},
      ),
    );

    final reward = (await repository.getRewards(null)).single;

    expect(reward.merchantName, 'EcoLoop Demonstration');
    expect(reward.expiresAt.toUtc(), DateTime.utc(2026, 12, 31));
  });

  test('maps persisted voucher merchant and SDK timestamps', () {
    final voucher = ResidentVoucher.fromJson({
      'id': 'voucher-owner',
      'residentId': 'resident-owner',
      'rewardId': 'reward-snack',
      'title': 'Vending snack',
      'merchant': 'EcoLoop Demonstration',
      'code': 'DEMO-SNACK',
      'terms': 'Single use',
      'issuedAt': Timestamp.fromDate(DateTime.utc(2026, 10, 20)),
      'expiresAt': Timestamp.fromDate(DateTime.utc(2026, 11, 20)),
      'status': 'available',
      'remainingUses': 1,
      'usedAt': null,
      'demo': true,
      'offerVersion': 'v1',
    });

    expect(voucher.merchantName, 'EcoLoop Demonstration');
    expect(voucher.issuedAt.toUtc(), DateTime.utc(2026, 10, 20));
    expect(voucher.demo, isTrue);
  });
}

class _SeedReads implements RewardsReadTransport {
  @override
  Future<List<JsonMap>> readCollection(String collection) async {
    if (collection == 'rewards') {
      return [
        {
          'id': 'reward-snack',
          'title': 'Vending snack',
          'description': 'Demo offer',
          'merchant': 'EcoLoop Demonstration',
          'categoryId': 'food',
          'pointsCost': 10,
          'catalogExpiresAt': Timestamp.fromDate(DateTime.utc(2026, 12, 31)),
          'isActive': true,
          'maxRedemptionsPerResident': 1,
          'artKey': 'snack',
          'sortOrder': 1,
        },
      ];
    }
    return const [];
  }

  @override
  Future<List<JsonMap>> readOwnerVouchers(String uid) async => const [];

  @override
  Future<JsonMap?> readDocument(String collection, String id) async => null;

  @override
  Stream<List<JsonMap>> watchCollection(String collection) =>
      const Stream.empty();

  @override
  Stream<List<JsonMap>> watchOwnerVouchers(String uid) => const Stream.empty();

  @override
  Stream<JsonMap?> watchDocument(String collection, String id) =>
      const Stream.empty();
}

class _MemoryPreferences implements PendingOperationPreferences {
  String? value;

  @override
  Future<String?> read(String key) async => value;

  @override
  Future<void> remove(String key) async => value = null;

  @override
  Future<void> write(String key, String value) async => this.value = value;
}
