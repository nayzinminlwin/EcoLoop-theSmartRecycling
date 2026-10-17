import 'package:eco_loop/features/activity/domain/models/deposit_filter.dart';
import 'package:eco_loop/features/activity/domain/models/deposit_transaction.dart';
import 'package:eco_loop/features/rewards/domain/models/resident_voucher.dart';

abstract final class RouteParameterParsers {
  static String? opaqueId(String? value) {
    final decoded = switch (value) {
      null => null,
      final raw => _decode(raw),
    };
    return decoded == null || decoded.isEmpty ? null : decoded;
  }

  static String? _decode(String raw) {
    try {
      return Uri.decodeComponent(raw).trim();
    } on FormatException {
      return null;
    } on ArgumentError {
      return null;
    }
  }

  static final _calendarDayPattern = RegExp(r'^\d{4}-\d{2}-\d{2}$');

  /// Parses a strict `yyyy-MM-dd` calendar day and returns the absolute
  /// instant of that day's midnight at the demo display offset.
  static DateTime? calendarDate(String? value, {int utcOffsetMinutes = 480}) {
    if (value == null || value.isEmpty) return null;
    final raw = Uri.decodeComponent(value);
    if (!_calendarDayPattern.hasMatch(raw)) return null;
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return null;
    final day = DateTime(parsed.year, parsed.month, parsed.day);
    return DateTime.utc(
      day.year,
      day.month,
      day.day,
    ).subtract(Duration(minutes: utcOffsetMinutes));
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

  static DepositFilter historyFilter(
    Map<String, String> query, {
    int utcOffsetMinutes = 480,
  }) {
    final from = calendarDate(
      query['from'],
      utcOffsetMinutes: utcOffsetMinutes,
    );
    final to = calendarDate(query['to'], utcOffsetMinutes: utcOffsetMinutes);
    return DepositFilter(
      from: from,
      toExclusive: to?.add(const Duration(days: 1)),
      status: depositStatus(query['status']),
    );
  }
}
