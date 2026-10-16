// ignore_for_file: prefer_initializing_formals

import 'dart:async';

import 'package:eco_loop/core/data/app_failure.dart';
import 'package:eco_loop/core/mock/app_clock.dart';
import 'package:eco_loop/core/mock/mock_api.dart';
import 'package:eco_loop/core/mock/mock_data_store.dart';
import 'package:eco_loop/core/mock/mock_seed_loader.dart';
import 'package:eco_loop/features/wallet/domain/models/wallet_snapshot.dart';

import '../domain/models/reward.dart';
import '../domain/models/reward_category.dart';
import '../domain/models/reward_redemption.dart';
import '../domain/models/resident_voucher.dart';
import '../domain/repositories/rewards_repository.dart';

class MockRewardsRepository implements RewardsRepository {
  static const _residentId = 'RES-000842';

  MockRewardsRepository({
    MockDataStore? store,
    MockApi? api,
    AppClock? clock,
    MockSeedLoader? seedLoader,
    List<RewardCategory>? categories,
    List<RewardDocument>? rewards,
    List<ResidentVoucher>? vouchers,
  }) : _store = store,
       _api = api ?? MockApi(),
       _clock = clock ?? AppClock(),
       _seedLoader = seedLoader ?? const MockSeedLoader(),
       _categories = [...?categories],
       _documents = [...?rewards],
       _vouchers = [...?vouchers],
       _usesSeedFixtures =
           categories == null && rewards == null && vouchers == null;

  final MockDataStore? _store;
  final MockApi _api;
  final AppClock _clock;
  final MockSeedLoader _seedLoader;
  final List<RewardCategory> _categories;
  final List<RewardDocument> _documents;
  final List<ResidentVoucher> _vouchers;
  final bool _usesSeedFixtures;
  Future<void>? _seedOperation;
  final List<RewardRedemption> _redemptions = [];
  final _categoryChanges = StreamController<void>.broadcast();
  final _rewardChanges = StreamController<void>.broadcast();
  final _voucherChanges = StreamController<void>.broadcast();
  Future<void> _mutationTail = Future<void>.value();

  DateTime get _now => _clock.now;

  Future<void> _ensureSeeded() => _seedOperation ??= _loadSeedFixtures();

  Future<void> _loadSeedFixtures() async {
    if (!_usesSeedFixtures) {
      return;
    }
    final categoryItems = await _seedLoader.loadItems(
      'assets/mock/rewards/categories.json',
    );
    final rewardItems = await _seedLoader.loadItems(
      'assets/mock/rewards/catalog.json',
    );
    final voucherItems = await _seedLoader.loadItems(
      'assets/mock/rewards/vouchers.json',
    );
    final redemptionItems = await _seedLoader.loadItems(
      'assets/mock/rewards/redemptions.json',
    );
    _categories
      ..clear()
      ..addAll(categoryItems.map(RewardCategory.fromMap));
    _documents
      ..clear()
      ..addAll(rewardItems.map(RewardDocument.fromMap));
    _vouchers
      ..clear()
      ..addAll(voucherItems.map(ResidentVoucher.fromMap));
    _redemptions
      ..clear()
      ..addAll(redemptionItems.map(RewardRedemption.fromMap));
  }

  @override
  Future<List<RewardCategory>> getCategories() =>
      _api.read('rewards.getCategories', () async {
        await _ensureSeeded();
        return [..._categories]
          ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
      });

  @override
  Future<List<Reward>> getRewards(String? categoryId) =>
      _api.read('rewards.getRewards', () async {
        await _ensureSeeded();
        return _projectRewards(categoryId);
      });

  @override
  Future<Reward> getReward(String rewardId) async {
    final rewards = await getRewards(null);
    return rewards.firstWhere(
      (reward) => reward.id == rewardId,
      orElse: () => throw MockDataStore.notFound('reward'),
    );
  }

  @override
  Future<RewardRedemptionReceipt> redeemReward(
    String rewardId,
    String idempotencyKey,
  ) {
    final operation = _mutationTail.then(
      (_) => _api.write(
        'rewards.redeemReward',
        () => _redeem(rewardId, idempotencyKey),
      ),
    );
    _mutationTail = operation.then<void>(
      (_) {},
      onError: (Object error, StackTrace stackTrace) {},
    );
    return operation;
  }

  Future<RewardRedemptionReceipt> _redeem(
    String rewardId,
    String idempotencyKey,
  ) async {
    await _ensureSeeded();
    final previous = _redemptions.where(
      (redemption) => redemption.idempotencyKey == idempotencyKey,
    );
    if (previous.isNotEmpty) return _receipt(previous.first);

    final reward = await getReward(rewardId);
    if (!reward.isActive || !reward.expiresAt.isAfter(_now)) {
      throw const AppFailure(
        code: AppFailureCodes.validation,
        messageKey: 'rewards.unavailable',
        retryable: false,
      );
    }
    if (reward.residentRedemptionCount >= reward.maxRedemptionsPerResident) {
      throw const AppFailure(
        code: AppFailureCodes.conflict,
        messageKey: 'rewards.limitReached',
        retryable: false,
      );
    }
    final wallet = await _wallet();
    if (wallet.balance < reward.pointsCost) {
      throw const AppFailure(
        code: AppFailureCodes.insufficientPoints,
        messageKey: 'rewards.insufficientPoints',
        retryable: false,
      );
    }
    final now = _now;
    final newBalance = wallet.balance - reward.pointsCost;
    final redemption = RewardRedemption(
      id: 'redemption-${_redemptions.length + 1}',
      residentId: wallet.residentId,
      rewardId: reward.id,
      idempotencyKey: idempotencyKey,
      pointsSpent: reward.pointsCost,
      redeemedAt: now,
      voucherId: 'voucher-${_redemptions.length + 1}',
      walletBalanceAfter: newBalance,
      walletVersion: wallet.version + 1,
    );
    final voucher = ResidentVoucher(
      id: redemption.voucherId,
      residentId: wallet.residentId,
      rewardId: reward.id,
      title: reward.title,
      merchantName: reward.merchantName,
      code: 'ECO-${redemption.id.substring(10).padLeft(4, '0')}',
      terms: 'Valid for one use. See merchant terms before redeeming.',
      issuedAt: now,
      expiresAt: reward.expiresAt,
      status: VoucherStatus.available,
      remainingUses: 1,
      usedAt: null,
    );
    if (_store != null) {
      await _store.transaction<void>((profile, walletMap, deposits) {
        final document = walletMap['wallet'] is Map
            ? (walletMap['wallet'] as Map).map(
                (key, value) => MapEntry(key.toString(), value),
              )
            : walletMap;
        document['balance'] = newBalance;
        document['updatedAt'] = now.toIso8601String();
        document['version'] = wallet.version + 1;
        if (walletMap['wallet'] is Map) {
          walletMap['wallet'] = document;
        }
      });
    }
    _redemptions.add(redemption);
    _vouchers.add(voucher);
    _rewardChanges.add(null);
    _voucherChanges.add(null);
    return RewardRedemptionReceipt(
      redemption: redemption,
      voucher: voucher,
      wallet: await _wallet(),
    );
  }

  Future<WalletSnapshot> _wallet() async {
    final raw = _store?.wallet;
    final document = raw?['wallet'] is Map
        ? (raw!['wallet'] as Map).map(
            (key, value) => MapEntry(key.toString(), value),
          )
        : raw;
    final balance = (document?['balance'] as num?)?.toInt() ?? 0;
    final version = (document?['version'] as num?)?.toInt() ?? 0;
    final updatedAt = document?['updatedAt'] is String
        ? DateTime.parse(document!['updatedAt'] as String)
        : _now;
    final residentId = document?['residentId'] as String? ?? 'RES-000842';
    return WalletSnapshot(
      residentId: residentId,
      balance: balance,
      nextRewardCost: null,
      updatedAt: updatedAt,
      version: version,
    );
  }

  @override
  Future<List<ResidentVoucher>> getVouchers(VoucherStatus? status) =>
      _api.read('rewards.getVouchers', () async {
        await _ensureSeeded();
        return _projectVouchers(status);
      });

  @override
  Future<ResidentVoucher> getVoucher(String voucherId) async =>
      (await getVouchers(null)).firstWhere(
        (voucher) => voucher.id == voucherId,
        orElse: () => throw MockDataStore.notFound('voucher'),
      );

  List<Reward> _projectRewards(String? categoryId) =>
      _documents
          .where(
            (document) =>
                categoryId == null || document.categoryId == categoryId,
          )
          .where(
            (document) => document.isActive && document.expiresAt.isAfter(_now),
          )
          .map(
            (document) => Reward(
              id: document.id,
              title: document.title,
              description: document.description,
              merchantName: document.merchantName,
              categoryId: document.categoryId,
              tag: document.tag,
              imageUrl: document.imageUrl,
              pointsCost: document.pointsCost,
              expiresAt: document.expiresAt,
              isActive: document.isActive,
              maxRedemptionsPerResident: document.maxRedemptionsPerResident,
              residentRedemptionCount: _redemptions
                  .where((redemption) => redemption.rewardId == document.id)
                  .length,
              artKey: document.artKey,
              sortOrder: document.sortOrder,
            ),
          )
          .toList()
        ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));

  List<ResidentVoucher> _projectVouchers(VoucherStatus? status) {
    final projected =
        _vouchers
            .where((voucher) => voucher.residentId == _residentId)
            .map(
              (voucher) => voucher.statusAt(_now) == voucher.status
                  ? voucher
                  : ResidentVoucher(
                      id: voucher.id,
                      residentId: voucher.residentId,
                      rewardId: voucher.rewardId,
                      title: voucher.title,
                      merchantName: voucher.merchantName,
                      code: voucher.code,
                      terms: voucher.terms,
                      issuedAt: voucher.issuedAt,
                      expiresAt: voucher.expiresAt,
                      status: voucher.statusAt(_now),
                      remainingUses: voucher.remainingUses,
                      usedAt: voucher.usedAt,
                    ),
            )
            .where((voucher) => status == null || voucher.status == status)
            .toList()
          ..sort((a, b) => b.issuedAt.compareTo(a.issuedAt));
    return projected;
  }

  Future<RewardRedemptionReceipt> _receipt(RewardRedemption redemption) async {
    final voucher = _vouchers.firstWhere(
      (item) => item.id == redemption.voucherId,
    );
    return RewardRedemptionReceipt(
      redemption: redemption,
      voucher: voucher,
      wallet: await _wallet(),
    );
  }

  @override
  Stream<List<RewardCategory>> watchCategories() async* {
    yield await getCategories();
    await for (final _ in _categoryChanges.stream) {
      yield await getCategories();
    }
  }

  @override
  Stream<List<Reward>> watchRewards({String? categoryId}) async* {
    yield await getRewards(categoryId);
    await for (final _ in _rewardChanges.stream) {
      yield await getRewards(categoryId);
    }
  }

  @override
  Stream<Reward?> watchReward(String rewardId) async* {
    Reward? read() {
      final matches = _projectRewards(null)
          .where((item) => item.id == rewardId);
      return matches.isEmpty ? null : matches.first;
    }

    yield read();
    await for (final _ in _rewardChanges.stream) {
      yield read();
    }
  }

  @override
  Stream<List<ResidentVoucher>> watchVouchers({VoucherStatus? status}) async* {
    yield await getVouchers(status);
    await for (final _ in _voucherChanges.stream) {
      yield await getVouchers(status);
    }
  }

  @override
  Stream<ResidentVoucher?> watchVoucher(String voucherId) async* {
    ResidentVoucher? read() {
      final matches = _projectVouchers(null)
          .where((item) => item.id == voucherId);
      return matches.isEmpty ? null : matches.first;
    }

    yield read();
    await for (final _ in _voucherChanges.stream) {
      yield read();
    }
  }
}
