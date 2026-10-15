import 'package:eco_loop/core/data/json_readers.dart';

class WalletDocument {
  const WalletDocument({
    required this.residentId,
    required this.balance,
    required this.updatedAt,
    required this.version,
  });

  final String residentId;
  final int balance;
  final DateTime updatedAt;
  final int version;

  factory WalletDocument.fromJson(JsonMap json) => WalletDocument(
    residentId: JsonReaders.string(json, 'residentId'),
    balance: JsonReaders.integer(json, 'balance'),
    updatedAt: JsonReaders.dateTime(json, 'updatedAt'),
    version: JsonReaders.integer(json, 'version'),
  );

  JsonMap toJson() => {
    'residentId': residentId,
    'balance': balance,
    'updatedAt': updatedAt.toIso8601String(),
    'version': version,
  };
}

class WalletSnapshot {
  const WalletSnapshot({
    required this.residentId,
    required this.balance,
    required this.nextRewardCost,
    required this.updatedAt,
    required this.version,
  });

  final String residentId;
  final int balance;
  final int? nextRewardCost;
  final DateTime updatedAt;
  final int version;

  factory WalletSnapshot.fromJson(JsonMap json) => WalletSnapshot(
    residentId: JsonReaders.string(json, 'residentId'),
    balance: JsonReaders.integer(json, 'balance'),
    nextRewardCost: json['nextRewardCost'] == null
        ? null
        : JsonReaders.integer(json, 'nextRewardCost'),
    updatedAt: JsonReaders.dateTime(json, 'updatedAt'),
    version: JsonReaders.integer(json, 'version'),
  );

  JsonMap toJson() => {
    'residentId': residentId,
    'balance': balance,
    'nextRewardCost': nextRewardCost,
    'updatedAt': updatedAt.toIso8601String(),
    'version': version,
  };
}
