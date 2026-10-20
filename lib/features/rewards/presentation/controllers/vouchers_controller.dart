import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/providers/app_providers.dart';
import '../../domain/models/resident_voucher.dart';
import '../../domain/repositories/rewards_repository.dart';

final vouchersProvider =
    StreamProvider.family<List<ResidentVoucher>, VoucherStatus?>(
      (ref, status) =>
          _refreshingList(ref.watch(rewardsRepositoryProvider), status),
    );

final voucherProvider = StreamProvider.family<ResidentVoucher?, String>(
  (ref, id) => _refreshingVoucher(ref.watch(rewardsRepositoryProvider), id),
);

Stream<List<ResidentVoucher>> _refreshingList(
  RewardsRepository repository,
  VoucherStatus? status,
) async* {
  yield await repository.getVouchers(status);
  final updates = repository.watchVouchers(status: status);
  await for (final items in updates) {
    yield items;
  }
}

Stream<ResidentVoucher?> _refreshingVoucher(
  RewardsRepository repository,
  String id,
) async* {
  yield await repository.getVoucher(id);
  await for (final voucher in repository.watchVoucher(id)) {
    yield voucher;
  }
}
