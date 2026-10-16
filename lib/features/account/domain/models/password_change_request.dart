import 'package:eco_loop/core/data/json_readers.dart';

class PasswordChangeRequest {
  const PasswordChangeRequest({
    required this.currentPassword,
    required this.newPassword,
  });

  final String currentPassword;
  final String newPassword;

  factory PasswordChangeRequest.fromJson(JsonMap json) => PasswordChangeRequest(
    currentPassword: JsonReaders.string(json, 'currentPassword'),
    newPassword: JsonReaders.string(json, 'newPassword'),
  );

  JsonMap toJson() => {
    'currentPassword': currentPassword,
    'newPassword': newPassword,
  };
}
