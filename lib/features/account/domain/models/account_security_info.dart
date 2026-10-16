import 'package:eco_loop/core/data/json_readers.dart';

class AccountSecurityInfo {
  const AccountSecurityInfo({
    required this.residentId,
    required this.passwordUpdatedAt,
    required this.isProtected,
  });

  final String residentId;
  final DateTime passwordUpdatedAt;
  final bool isProtected;

  factory AccountSecurityInfo.fromJson(JsonMap json) => AccountSecurityInfo(
    residentId: JsonReaders.string(json, 'residentId'),
    passwordUpdatedAt: JsonReaders.dateTime(json, 'passwordUpdatedAt'),
    isProtected: JsonReaders.boolean(json, 'isProtected'),
  );

  JsonMap toJson() => {
    'residentId': residentId,
    'passwordUpdatedAt': passwordUpdatedAt.toIso8601String(),
    'isProtected': isProtected,
  };
}
