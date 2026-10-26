import 'package:eco_loop/core/data/json_readers.dart';
import 'package:eco_loop/core/data/pending_operation_store.dart';
import 'package:eco_loop/core/firebase/command_client.dart';
import 'package:eco_loop/features/rewards/data/firebase_rewards_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'sends the current offer version and displayed cost and maps the receipt',
    () async {
      final calls = <Map<String, Object?>>[];
      final repository = FirebaseRewardsRepository(
        uid: 'resident-1',
        reads: _FakeRewardsReads(),
        commandClient: CommandClient(
          uid: 'resident-1',
          store: PendingOperationStore(preferences: _MemoryPreferences()),
          requestIdFactory: () => 'request-1',
          transport: (operation, payload) async {
            calls.add(payload);
            return {
              'schemaVersion': 'backend.v1',
              'operation': operation,
              'requestId': 'request-1',
              'traceId': '0123456789abcdef0123456789abcdef',
              'status': 'committed',
              'data': {
                'redemptionId': 'redemption-1',
                'voucherId': 'voucher-1',
                'voucherCode': 'DEMO-ABC',
                'rewardId': 'reward-1',
                'offerVersion': 'v2',
                'cost': 25,
                'balance': 12,
                'expiresAt': '2026-11-18T00:00:00.000Z',
                'issuedAt': '2026-10-19T00:00:00.000Z',
                'redeemedAt': '2026-10-19T00:00:00.000Z',
                'walletVersion': 2,
                'title': 'Coffee',
                'merchant': 'EcoLoop Cafe',
                'terms': 'One demo voucher',
              },
            };
          },
        ),
      );

      final receipt = await repository.redeemReward(
        'reward-1',
        'request-1',
        offerVersion: 'v2',
        displayedCost: 25,
      );

      expect(calls.single['payload'], {
        'rewardId': 'reward-1',
        'offerVersion': 'v2',
        'displayedCost': 25,
      });
      expect(receipt.voucher.code, 'DEMO-ABC');
      expect(receipt.voucher.merchantName, 'EcoLoop Cafe');
      expect(receipt.wallet.balance, 12);
      expect(receipt.redemption.pointsSpent, 25);
      expect(_FakeRewardsReads.readDocumentCalls, 0);
    },
  );
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

class _FakeRewardsReads implements RewardsReadTransport {
  static int readDocumentCalls = 0;

  @override
  Future<List<JsonMap>> readOwnerVouchers(String uid) async => const [];

  @override
  Future<List<JsonMap>> readCollection(String collection) async {
    if (collection == 'vouchers') return const [];
    return const [];
  }

  @override
  Future<JsonMap?> readDocument(String collection, String id) async {
    readDocumentCalls++;
    if (collection != 'rewards') return null;
    return {
      'id': id,
      'title': 'Coffee',
      'description': 'One demo voucher',
      'merchantName': 'EcoLoop Cafe',
      'categoryId': 'food',
      'pointsCost': 25,
      'catalogExpiresAt': '2026-12-31T00:00:00.000Z',
      'offerVersion': 'v2',
      'maxRedemptionsPerResident': 1,
      'isActive': true,
      'residentRedemptionCount': 0,
      'artKey': 'cafe',
      'sortOrder': 1,
    };
  }

  @override
  Stream<List<JsonMap>> watchCollection(String collection) =>
      const Stream<List<JsonMap>>.empty();

  @override
  Stream<List<JsonMap>> watchOwnerVouchers(String uid) =>
      const Stream<List<JsonMap>>.empty();

  @override
  Stream<JsonMap?> watchDocument(String collection, String id) =>
      const Stream<JsonMap?>.empty();
}
