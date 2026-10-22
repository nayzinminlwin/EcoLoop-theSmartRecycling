import 'package:eco_loop/core/domain/material_type.dart';
import 'package:eco_loop/core/domain/material_weight_constants.dart';
import 'package:eco_loop/core/mock/mock_seed_loader.dart';
import 'package:eco_loop/features/activity/domain/models/deposit_transaction.dart';
import 'package:eco_loop/features/rewards/domain/models/reward.dart';
import 'package:eco_loop/features/rewards/domain/models/resident_voucher.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const loader = MockSeedLoader();

  test(
    'resident fixtures have coherent references and derived totals',
    () async {
      final profile = await loader.loadMap('assets/mock/account/profile.json');
      final wallet = await loader.loadMap('assets/mock/wallet/wallet.json');
      final deposits = (await loader.loadItems(
        'assets/mock/activity/deposits.json',
      )).map(DepositTransaction.fromJson).toList();
      final categories = await loader.loadItems(
        'assets/mock/rewards/categories.json',
      );
      final rewards = (await loader.loadItems(
        'assets/mock/rewards/catalog.json',
      )).map(RewardDocument.fromMap).toList();
      final vouchers = (await loader.loadItems(
        'assets/mock/rewards/vouchers.json',
      )).map(ResidentVoucher.fromMap).toList();

      expect(profile['id'], 'RES-000842');
      expect(wallet['wallet'], isA<Map>());
      expect(
        _unique(deposits.map((item) => item.id)),
        hasLength(deposits.length),
      );
      expect(
        _unique(rewards.map((item) => item.id)),
        hasLength(rewards.length),
      );
      expect(
        _unique(vouchers.map((item) => item.id)),
        hasLength(vouchers.length),
      );

      final verified = deposits
          .where((item) => item.status == DepositStatus.verified)
          .toList();
      expect(verified, hasLength(12));
      expect(
        verified.fold<int>(0, (sum, item) => sum + (item.itemCount ?? 0)),
        26,
      );
      expect(
        verified.fold<double>(
          0,
          (sum, item) =>
              sum +
              MaterialWeightConstants.getWeightKg(
                item.materialType,
                item.itemCount ?? 0,
              ),
        ),
        closeTo(1.04, 0.0001),
      );
      expect(
        deposits.where((item) => item.status == DepositStatus.review),
        hasLength(1),
      );
      expect(
        deposits.where((item) => item.status == DepositStatus.rejected),
        hasLength(1),
      );
      expect(
        rewards.map((item) => item.categoryId).toSet(),
        everyElement(isIn(categories.map((item) => item['id']))),
      );
      expect(
        vouchers.every((voucher) => voucher.residentId == 'RES-000842'),
        isTrue,
      );
      expect(
        rewards
            .where((reward) => reward.isActive)
            .map((reward) => reward.pointsCost)
            .toList(),
        [10, 25, 50, 75],
      );
      expect((wallet['wallet'] as Map)['balance'], 245);
    },
  );

  test(
    'fixture dates are ordered and nullable fields retain their meaning',
    () async {
      final items = (await loader.loadItems(
        'assets/mock/activity/deposits.json',
      )).map(DepositTransaction.fromJson).toList();

      for (var index = 1; index < items.length; index++) {
        expect(
          items[index - 1].occurredAt.isAfter(items[index].occurredAt),
          isTrue,
        );
      }
      expect(
        items
            .singleWhere((item) => item.status == DepositStatus.review)
            .pointsAwarded,
        isNull,
      );
      expect(
        items
            .singleWhere((item) => item.status == DepositStatus.rejected)
            .verifiedAt,
        isNull,
      );
      expect(
        items.every(
          (item) =>
              item.materialType != MaterialType.unknown ||
              item.status == DepositStatus.rejected,
        ),
        isTrue,
      );
    },
  );
}

Set<T> _unique<T>(Iterable<T> values) => values.toSet();
