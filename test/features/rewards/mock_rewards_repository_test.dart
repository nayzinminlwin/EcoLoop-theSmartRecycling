import 'package:eco_loop/core/mock/app_clock.dart';
import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/core/mock/mock_data_store.dart';
import 'package:eco_loop/features/rewards/data/mock_rewards_repository.dart';
import 'package:eco_loop/features/rewards/domain/models/reward.dart';
import 'package:eco_loop/features/rewards/domain/models/resident_voucher.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  MockDataStore store() => MockDataStore(
    profile: const {'id': 'RES-000842'},
    wallet: const {
      'residentId': 'RES-000842',
      'balance': 25,
      'updatedAt': '2024-05-20T11:00:00+08:00',
      'version': 1,
    },
    deposits: const [],
    clock: AppClock(),
  );

  test(
    'reward and voucher documents round-trip without embedded projections',
    () {
      final document = RewardDocument.fromMap({
        'id': 'reward',
        'title': 'Snack',
        'description': 'Demo',
        'merchantName': 'Merchant',
        'categoryId': 'food',
        'tag': null,
        'imageUrl': null,
        'pointsCost': 10,
        'expiresAt': '2024-06-30T23:59:00.000',
        'isActive': true,
        'maxRedemptionsPerResident': 1,
        'artKey': 'snack',
        'sortOrder': 1,
      });
      expect(document.toMap(), isNot(contains('residentRedemptionCount')));
      final voucher = ResidentVoucher.fromJson({
        'id': 'voucher',
        'residentId': 'RES-000842',
        'rewardId': null,
        'title': 'Welcome',
        'merchantName': 'Demo',
        'code': 'CODE',
        'terms': 'One use',
        'issuedAt': '2024-05-01T09:00:00.000+08:00',
        'expiresAt': '2024-05-31T23:59:00.000+08:00',
        'status': 'unexpected',
        'remainingUses': 1,
        'usedAt': null,
      });
      expect(voucher.status, VoucherStatus.unknown);
    },
  );

  test('redemption debits once and retries by idempotency key return the same voucher', () async {
    final repository = MockRewardsRepository(
      store: store(),
      api: MockApi(readDelay: Duration.zero, writeDelay: Duration.zero),
    );
    final first = await repository.redeemReward('reward-snack', 'attempt-1');
    final repeated = await repository.redeemReward('reward-snack', 'attempt-1');

    expect(first.voucher.id, repeated.voucher.id);
    expect(first.wallet.balance, 15);
    expect(repeated.wallet.balance, 15);
    expect((await repository.getVouchers(null)), hasLength(2));
  });

  test('concurrent redemptions cannot overspend the shared wallet', () async {
    final repository = MockRewardsRepository(
      store: store(),
      api: MockApi(readDelay: Duration.zero, writeDelay: Duration.zero),
    );
    final results = await Future.wait<Object?>([
      repository
          .redeemReward('reward-snack', 'attempt-a')
          .then<Object?>((value) => value, onError: (Object error) => error),
      repository
          .redeemReward('reward-cafe', 'attempt-b')
          .then<Object?>((value) => value, onError: (Object error) => error),
    ]);

    expect(results.whereType<Exception>(), hasLength(1));
    expect((await repository.getVouchers(null)), hasLength(2));
    expect(
      (await repository.getReward('reward-snack')).residentRedemptionCount,
      1,
    );
  });

  test('vouchers are scoped to the active resident', () async {
    final repository = MockRewardsRepository(
      vouchers: [
        ResidentVoucher(
          id: 'other-voucher',
          residentId: 'RES-OTHER',
          rewardId: null,
          title: 'Other',
          merchantName: 'Other merchant',
          code: 'OTHER',
          terms: 'Other',
          issuedAt: DateTime(2024, 5, 1),
          expiresAt: DateTime(2024, 6, 1),
          status: VoucherStatus.available,
          remainingUses: 1,
          usedAt: null,
        ),
      ],
      api: MockApi(readDelay: Duration.zero, writeDelay: Duration.zero),
    );

    expect(await repository.getVouchers(null), isEmpty);
    expect(repository.getVoucher('other-voucher'), throwsA(isA<Exception>()));
  });
}
