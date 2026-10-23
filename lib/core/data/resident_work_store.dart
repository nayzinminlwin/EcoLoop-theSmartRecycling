import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class ResidentWorkReference {
  const ResidentWorkReference({
    required this.sessionId,
    required this.submittedAt,
    this.batchId,
    this.resultId,
    this.decisionVersion,
  });

  final String sessionId;
  final DateTime submittedAt;
  final String? batchId;
  final String? resultId;
  final int? decisionVersion;

  factory ResidentWorkReference.fromJson(Map<String, Object?> json) =>
      ResidentWorkReference(
        sessionId: json['sessionId']! as String,
        submittedAt: DateTime.parse(json['submittedAt']! as String),
        batchId: json['batchId'] as String?,
        resultId: json['resultId'] as String?,
        decisionVersion: json['decisionVersion'] as int?,
      );

  Map<String, Object?> toJson() => {
    'sessionId': sessionId,
    'submittedAt': submittedAt.toIso8601String(),
    'batchId': batchId,
    'resultId': resultId,
    'decisionVersion': decisionVersion,
  };
}

abstract interface class ResidentWorkPreferences {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> remove(String key);
}

class SharedPreferencesResidentWorkPreferences
    implements ResidentWorkPreferences {
  SharedPreferencesResidentWorkPreferences({
    SharedPreferencesAsync? preferences,
  }) : _preferences = preferences ?? SharedPreferencesAsync();

  final SharedPreferencesAsync _preferences;

  @override
  Future<String?> read(String key) => _preferences.getString(key);

  @override
  Future<void> write(String key, String value) =>
      _preferences.setString(key, value);

  @override
  Future<void> remove(String key) => _preferences.remove(key);
}

class MemoryResidentWorkPreferences implements ResidentWorkPreferences {
  final Map<String, String> values = {};

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> write(String key, String value) async {
    values[key] = value;
  }

  @override
  Future<void> remove(String key) async {
    values.remove(key);
  }
}

class ResidentWorkStore {
  ResidentWorkStore({ResidentWorkPreferences? preferences})
    : _preferences = preferences ?? MemoryResidentWorkPreferences();

  final ResidentWorkPreferences _preferences;

  String _referenceKey(String residentId) =>
      'ecoloop.resident_work.reference.$residentId';

  String _seenKey(String residentId, String resultId, int? decisionVersion) =>
      'ecoloop.resident_work.seen.$residentId.$resultId.${decisionVersion ?? 0}';

  Future<ResidentWorkReference?> readReference(String residentId) async {
    final encoded = await _preferences.read(_referenceKey(residentId));
    if (encoded == null) return null;
    try {
      final value = jsonDecode(encoded);
      if (value is! Map) {
        throw const FormatException('Reference is not an object');
      }
      return ResidentWorkReference.fromJson(Map<String, Object?>.from(value));
    } on FormatException {
      await _preferences.remove(_referenceKey(residentId));
      return null;
    }
  }

  Future<void> writeReference(
    String residentId,
    ResidentWorkReference reference,
  ) => _preferences.write(
    _referenceKey(residentId),
    jsonEncode(reference.toJson()),
  );

  Future<bool> isSeen(
    String residentId,
    String resultId,
    int? decisionVersion,
  ) async =>
      (await _preferences.read(
        _seenKey(residentId, resultId, decisionVersion),
      )) ==
      'seen';

  Future<void> markSeen(
    String residentId,
    String resultId,
    int? decisionVersion,
  ) => _preferences.write(
    _seenKey(residentId, resultId, decisionVersion),
    'seen',
  );
}
