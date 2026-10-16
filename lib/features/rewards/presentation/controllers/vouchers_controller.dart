import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/providers/app_providers.dart';
import '../../domain/models/resident_voucher.dart';

final vouchersProvider =
    FutureProvider.family<List<ResidentVoucher>, VoucherStatus?>(
      (ref, status) => ref.watch(rewardsRepositoryProvider).getVouchers(status),
    );

final voucherProvider = FutureProvider.family<ResidentVoucher, String>(
  (ref, id) => ref.watch(rewardsRepositoryProvider).getVoucher(id),
);
