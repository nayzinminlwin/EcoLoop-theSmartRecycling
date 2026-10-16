import 'package:eco_loop/core/data/json_readers.dart';

enum VoucherStatus {
  available('available'),
  used('used'),
  expired('expired'),
  unknown('unknown');

  const VoucherStatus(this.wireValue);
  final String wireValue;

  static VoucherStatus fromWire(String? value) => VoucherStatus.values
      .firstWhere((status) => status.wireValue == value, orElse: () => unknown);
}

class ResidentVoucher {
  const ResidentVoucher({
    required this.id,
    required this.residentId,
    required this.rewardId,
    required this.title,
    required this.merchantName,
    required this.code,
    required this.terms,
    required this.issuedAt,
    required this.expiresAt,
    required this.status,
    required this.remainingUses,
    required this.usedAt,
  });

  final String id;
  final String residentId;
  final String? rewardId;
  final String title;
  final String merchantName;
  final String code;
  final String terms;
  final DateTime issuedAt;
  final DateTime expiresAt;
  final VoucherStatus status;
  final int remainingUses;
  final DateTime? usedAt;

  VoucherStatus statusAt(DateTime now) {
    if (status == VoucherStatus.available && !expiresAt.isAfter(now)) {
      return VoucherStatus.expired;
    }
    return status;
  }

  factory ResidentVoucher.fromMap(JsonMap json) => ResidentVoucher(
    id: JsonReaders.string(json, 'id'),
    residentId: JsonReaders.string(json, 'residentId'),
    rewardId: JsonReaders.nullableString(json, 'rewardId'),
    title: JsonReaders.string(json, 'title'),
    merchantName: JsonReaders.string(json, 'merchantName'),
    code: JsonReaders.string(json, 'code'),
    terms: JsonReaders.string(json, 'terms'),
    issuedAt: JsonReaders.dateTime(json, 'issuedAt'),
    expiresAt: JsonReaders.dateTime(json, 'expiresAt'),
    status: VoucherStatus.fromWire(json['status'] as String?),
    remainingUses: JsonReaders.integer(json, 'remainingUses'),
    usedAt: json['usedAt'] == null
        ? null
        : JsonReaders.dateTime(json, 'usedAt'),
  );

  JsonMap toMap() => {
    'id': id,
    'residentId': residentId,
    'rewardId': rewardId,
    'title': title,
    'merchantName': merchantName,
    'code': code,
    'terms': terms,
    'issuedAt': issuedAt.toIso8601String(),
    'expiresAt': expiresAt.toIso8601String(),
    'status': status.wireValue,
    'remainingUses': remainingUses,
    'usedAt': usedAt?.toIso8601String(),
  };

  JsonMap toJson() => toMap();
  factory ResidentVoucher.fromJson(JsonMap json) =>
      ResidentVoucher.fromMap(json);
}
