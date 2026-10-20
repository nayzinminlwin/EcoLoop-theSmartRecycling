import 'package:eco_loop/core/data/json_readers.dart';

class ResidentProfile {
  const ResidentProfile({
    required this.id,
    required this.fullName,
    required this.email,
    required this.avatarUrl,
    required this.createdAt,
  });

  final String id;
  final String fullName;
  final String email;
  final String? avatarUrl;
  final DateTime createdAt;

  String get firstName => fullName.trim().split(RegExp(r'\s+')).first;
  String get initials => fullName
      .trim()
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .take(2)
      .map((part) => part[0].toUpperCase())
      .join();

  factory ResidentProfile.fromJson(JsonMap json) => ResidentProfile(
    id: JsonReaders.string(json, json.containsKey('id') ? 'id' : 'residentId'),
    fullName: JsonReaders.string(
      json,
      json.containsKey('fullName') ? 'fullName' : 'displayName',
    ),
    email: JsonReaders.string(json, 'email'),
    avatarUrl: JsonReaders.nullableString(json, 'avatarUrl'),
    createdAt: JsonReaders.dateTime(json, 'createdAt'),
  );

  JsonMap toJson() => {
    'id': id,
    'fullName': fullName,
    'email': email,
    'avatarUrl': avatarUrl,
    'createdAt': createdAt.toIso8601String(),
  };
}
