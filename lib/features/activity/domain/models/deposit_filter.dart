import 'package:eco_loop/core/data/app_failure.dart';
import 'package:eco_loop/core/data/json_readers.dart';

import 'deposit_transaction.dart';

class DepositFilter {
  const DepositFilter({this.from, this.toExclusive, this.status});

  final DateTime? from;
  final DateTime? toExclusive;
  final DepositStatus? status;

  factory DepositFilter.fromJson(JsonMap json) => DepositFilter(
    from: json['from'] == null ? null : JsonReaders.dateTime(json, 'from'),
    toExclusive: json['toExclusive'] == null
        ? null
        : JsonReaders.dateTime(json, 'toExclusive'),
    status: json['status'] == null
        ? null
        : DepositStatus.fromWire(JsonReaders.string(json, 'status')),
  );

  JsonMap toJson() => {
    'from': from?.toIso8601String(),
    'toExclusive': toExclusive?.toIso8601String(),
    'status': status?.wireValue,
  };

  void validate() {
    if (from != null && toExclusive != null && !from!.isBefore(toExclusive!)) {
      throw const AppFailure(
        code: AppFailureCodes.validation,
        messageKey: 'activity.invalidDateRange',
        retryable: false,
      );
    }
  }
}
