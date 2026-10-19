import 'package:eco_loop/core/mock/app_clock.dart';
import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/features/rewards/data/mock_rewards_repository.dart';
import 'package:eco_loop/features/rewards/domain/models/resident_voucher.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'available demo voucher becomes used once and cannot be used again',
    () async {
      final repository = MockRewardsRepository(
        api: MockApi(readDelay: Duration.zero, writeDelay: Duration.zero),
        clock: AppClock(now: DateTime.parse('2024-05-20T11:00:00+08:00')),
      );
      final voucher = (await repository.getVouchers(VoucherStatus.available))
          .first;
      final used = await repository.useDemoVoucher(voucher.id, 'use-1');

      expect(used.status, VoucherStatus.used);
      expect(used.remainingUses, 0);
      expect(used.usedAt, isNotNull);
      expect(
        repository.useDemoVoucher(voucher.id, 'use-2'),
        throwsA(isA<Exception>()),
      );
    },
  );

  test(
    'statusAt expires only unused vouchers and never changes used status',
    () {
      final expires = DateTime(2024, 5, 20, 11);
      final available = ResidentVoucher(
        id: 'available',
        residentId: 'resident',
        rewardId: 'reward',
        title: 'Reward',
        merchantName: 'Merchant',
        code: 'CODE',
        terms: 'Terms',
        issuedAt: expires.subtract(const Duration(days: 1)),
        expiresAt: expires,
        status: VoucherStatus.available,
        remainingUses: 1,
        usedAt: null,
        demo: true,
      );
      final used = ResidentVoucher(
        id: 'used',
        residentId: 'resident',
        rewardId: 'reward',
        title: 'Reward',
        merchantName: 'Merchant',
        code: 'CODE',
        terms: 'Terms',
        issuedAt: expires.subtract(const Duration(days: 1)),
        expiresAt: expires,
        status: VoucherStatus.used,
        remainingUses: 0,
        usedAt: expires.subtract(const Duration(hours: 1)),
        demo: true,
      );

      expect(available.statusAt(expires), VoucherStatus.expired);
      expect(
        used.statusAt(expires.add(const Duration(days: 1))),
        VoucherStatus.used,
      );
    },
  );
}
