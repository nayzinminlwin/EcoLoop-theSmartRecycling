import 'package:eco_loop/core/data/json_readers.dart';

class AccountSecurityInfo {
  const AccountSecurityInfo({
    required this.residentId,
    this.passwordUpdatedAt,
    required this.isProtected,
    this.provider = 'unknown',
  });

  final String residentId;
  final DateTime? passwordUpdatedAt;
  final bool isProtected;
  final String provider;

  factory AccountSecurityInfo.fromJson(JsonMap json) => AccountSecurityInfo(
    residentId: JsonReaders.string(json, 'residentId'),
    passwordUpdatedAt: json['passwordUpdatedAt'] == null
        ? null
        : JsonReaders.dateTime(json, 'passwordUpdatedAt'),
    isProtected: JsonReaders.boolean(json, 'isProtected'),
    provider: json['provider'] is String
        ? json['provider']! as String
        : 'unknown',
  );

  JsonMap toJson() => {
    'residentId': residentId,
    'passwordUpdatedAt': passwordUpdatedAt?.toIso8601String(),
    'isProtected': isProtected,
    'provider': provider,
  };
}
