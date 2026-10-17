import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/providers/app_providers.dart';
import '../../domain/models/resident_voucher.dart';

final vouchersProvider =
    StreamProvider.family<List<ResidentVoucher>, VoucherStatus?>(
      (ref, status) =>
          ref.watch(rewardsRepositoryProvider).watchVouchers(status: status),
    );

final voucherProvider = FutureProvider.family<ResidentVoucher, String>(
  (ref, id) => ref.watch(rewardsRepositoryProvider).getVoucher(id),
);
