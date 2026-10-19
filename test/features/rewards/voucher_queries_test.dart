import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/features/rewards/data/mock_rewards_repository.dart';
import 'package:eco_loop/features/rewards/domain/models/resident_voucher.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('voucher status query applies time-correct available and expired projections', () async {
    final repository = MockRewardsRepository(
      api: MockApi(readDelay: Duration.zero, writeDelay: Duration.zero),
    );
    final available = await repository.getVouchers(VoucherStatus.available);
    final expired = await repository.getVouchers(VoucherStatus.expired);

    expect(
      available.every(
        (voucher) =>
            voucher.statusAt(DateTime(2024, 5, 20, 11)) ==
            VoucherStatus.available,
      ),
      isTrue,
    );
    expect(
      expired.every(
        (voucher) =>
            voucher.statusAt(DateTime(2024, 5, 20, 11)) ==
            VoucherStatus.expired,
      ),
      isTrue,
    );
  });

  test('voucher pages expose a stable cursor for the next page', () async {
    final repository = MockRewardsRepository(
      api: MockApi(readDelay: Duration.zero, writeDelay: Duration.zero),
    );

    final first = await repository.getVouchersPage(null, limit: 1);
    expect(first.items, hasLength(1));
    expect(first.nextCursor, isNotNull);

    final second = await repository.getVouchersPage(
      null,
      cursor: first.nextCursor,
      limit: 1,
    );
    expect(second.items.length, lessThanOrEqualTo(1));
    if (second.items.isNotEmpty) {
      expect(second.items.single.id, isNot(first.items.single.id));
    }
  });
}
