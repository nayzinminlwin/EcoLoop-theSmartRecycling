import 'package:eco_loop/core/data/json_readers.dart';
import 'package:eco_loop/features/wallet/domain/models/wallet_snapshot.dart';

import 'resident_voucher.dart';

class RewardRedemption {
  const RewardRedemption({
    required this.id,
    required this.residentId,
    required this.rewardId,
    required this.idempotencyKey,
    required this.pointsSpent,
    required this.redeemedAt,
    required this.voucherId,
    required this.walletBalanceAfter,
    required this.walletVersion,
  });

  final String id;
  final String residentId;
  final String rewardId;
  final String idempotencyKey;
  final int pointsSpent;
  final DateTime redeemedAt;
  final String voucherId;
  final int walletBalanceAfter;
  final int walletVersion;

  factory RewardRedemption.fromMap(JsonMap json) => RewardRedemption(
    id: JsonReaders.string(json, 'id'),
    residentId: JsonReaders.string(json, 'residentId'),
    rewardId: JsonReaders.string(json, 'rewardId'),
    idempotencyKey: JsonReaders.string(json, 'idempotencyKey'),
    pointsSpent: JsonReaders.integer(json, 'pointsSpent'),
    redeemedAt: JsonReaders.dateTime(json, 'redeemedAt'),
    voucherId: JsonReaders.string(json, 'voucherId'),
    walletBalanceAfter: JsonReaders.integer(json, 'walletBalanceAfter'),
    walletVersion: JsonReaders.integer(json, 'walletVersion'),
  );

  JsonMap toMap() => {
    'id': id,
    'residentId': residentId,
    'rewardId': rewardId,
    'idempotencyKey': idempotencyKey,
    'pointsSpent': pointsSpent,
    'redeemedAt': redeemedAt.toIso8601String(),
    'voucherId': voucherId,
    'walletBalanceAfter': walletBalanceAfter,
    'walletVersion': walletVersion,
  };

  JsonMap toJson() => toMap();
  factory RewardRedemption.fromJson(JsonMap json) =>
      RewardRedemption.fromMap(json);
}

class RewardRedemptionReceipt {
  const RewardRedemptionReceipt({
    required this.redemption,
    required this.voucher,
    required this.wallet,
  });

  final RewardRedemption redemption;
  final ResidentVoucher voucher;
  final WalletSnapshot wallet;

  JsonMap toJson() => {
    'redemption': redemption.toJson(),
    'voucher': voucher.toJson(),
    'wallet': wallet.toJson(),
  };
}
