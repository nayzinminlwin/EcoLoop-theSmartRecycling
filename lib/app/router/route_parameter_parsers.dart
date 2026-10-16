import 'package:eco_loop/features/activity/domain/models/deposit_filter.dart';
import 'package:eco_loop/features/activity/domain/models/deposit_transaction.dart';
import 'package:eco_loop/features/rewards/domain/models/resident_voucher.dart';

abstract final class RouteParameterParsers {
  static String? opaqueId(String? value) {
    final decoded = value == null ? null : Uri.decodeComponent(value).trim();
    return decoded == null || decoded.isEmpty ? null : decoded;
  }

  static DateTime? calendarDate(String? value) {
    if (value == null || value.isEmpty) return null;
    final parsed = DateTime.tryParse(value);
    if (parsed == null) return null;
    return DateTime(parsed.year, parsed.month, parsed.day);
  }

  static DepositStatus? depositStatus(String? value) {
    if (value == null) return null;
    final status = DepositStatus.fromWire(value);
    return status == DepositStatus.unknown ? null : status;
  }

  static VoucherStatus? voucherStatus(String? value) {
    if (value == null) return null;
    final status = VoucherStatus.fromWire(value);
    return status == VoucherStatus.unknown ? null : status;
  }

  static DepositFilter historyFilter(Map<String, String> query) {
    final from = calendarDate(query['from']);
    final to = calendarDate(query['to']);
    return DepositFilter(
      from: from,
      toExclusive: to?.add(const Duration(days: 1)),
      status: depositStatus(query['status']),
    );
  }
}
