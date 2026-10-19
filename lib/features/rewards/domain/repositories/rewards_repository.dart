import '../models/reward.dart';
import '../models/reward_category.dart';
import '../models/reward_redemption.dart';
import '../models/resident_voucher.dart';

abstract interface class RewardsRepository {
  Future<List<RewardCategory>> getCategories();
  Future<List<Reward>> getRewards(String? categoryId);
  Future<Reward> getReward(String rewardId);
  Future<RewardRedemptionReceipt> redeemReward(
    String rewardId,
    String idempotencyKey, {
    String? offerVersion,
    int? displayedCost,
  });
  Future<ResidentVoucher> useDemoVoucher(
    String voucherId,
    String idempotencyKey,
  );
  Future<List<ResidentVoucher>> getVouchers(VoucherStatus? status);
  Future<VoucherPage> getVouchersPage(
    VoucherStatus? status, {
    VoucherCursor? cursor,
    int limit = 25,
  });
  Future<ResidentVoucher> getVoucher(String voucherId);
  Stream<List<RewardCategory>> watchCategories();
  Stream<List<Reward>> watchRewards({String? categoryId});
  Stream<Reward?> watchReward(String rewardId);
  Stream<List<ResidentVoucher>> watchVouchers({VoucherStatus? status});
  Stream<ResidentVoucher?> watchVoucher(String voucherId);
}
