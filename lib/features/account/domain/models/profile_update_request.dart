import 'package:eco_loop/core/data/json_readers.dart';

class ProfileUpdateRequest {
  const ProfileUpdateRequest({
    required this.fullName,
    required this.email,
    required this.avatarUrl,
  });

  final String fullName;
  final String email;
  final String? avatarUrl;

  factory ProfileUpdateRequest.fromJson(JsonMap json) => ProfileUpdateRequest(
    fullName: JsonReaders.string(json, 'fullName'),
    email: JsonReaders.string(json, 'email'),
    avatarUrl: JsonReaders.nullableString(json, 'avatarUrl'),
  );

  JsonMap toJson() => {
    'fullName': fullName,
    'email': email,
    'avatarUrl': avatarUrl,
  };
}
