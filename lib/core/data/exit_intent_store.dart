import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'exit_intent.dart';

abstract interface class ExitIntentPreferences {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> remove(String key);
}

class SharedPreferencesExitIntentPreferences implements ExitIntentPreferences {
  SharedPreferencesExitIntentPreferences({SharedPreferencesAsync? preferences})
    : _preferences = preferences ?? SharedPreferencesAsync();

  final SharedPreferencesAsync _preferences;

  @override
  Future<String?> read(String key) => _preferences.getString(key);

  @override
  Future<void> write(String key, String value) =>
      _preferences.setString(key, value);

  @override
  Future<void> remove(String key) => _preferences.remove(key);
}

class MemoryExitIntentPreferences implements ExitIntentPreferences {
  final Map<String, String> values = <String, String>{};

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> remove(String key) async {
    values.remove(key);
  }

  @override
  Future<void> write(String key, String value) async {
    values[key] = value;
  }
}

class ExitIntentStore {
  ExitIntentStore({ExitIntentPreferences? preferences})
    : _preferences = preferences ?? MemoryExitIntentPreferences();

  static const _key = 'ecoloop.exit_intents.v1';
  static const _fenceKey = 'ecoloop.exit_fence.v1';
  final ExitIntentPreferences _preferences;

  Future<List<ExitIntent>> read() async {
    final encoded = await _preferences.read(_key);
    if (encoded == null) return <ExitIntent>[];
    try {
      final decoded = jsonDecode(encoded);
      if (decoded is! List) {
        throw const FormatException('Exit intent journal is not an array');
      }
      return decoded
          .map((entry) {
            if (entry is! Map) {
              throw const FormatException('Exit intent is not an object');
            }
            return ExitIntent.fromJson(Map<String, Object?>.from(entry));
          })
          .toList(growable: false);
    } on FormatException {
      await _preferences.remove(_key);
      rethrow;
    }
  }

  Future<void> write(Iterable<ExitIntent> intents) async {
    await _preferences.write(
      _key,
      jsonEncode(intents.map((intent) => intent.toJson()).toList()),
    );
  }

  Future<bool> readFence() async =>
      (await _preferences.read(_fenceKey)) == 'signed_out';

  Future<void> writeFence(bool signedOut) async {
    if (signedOut) {
      await _preferences.write(_fenceKey, 'signed_out');
    } else {
      await _preferences.remove(_fenceKey);
    }
  }

  Future<Set<String>> readAbandonedSessions() async {
    const key = 'ecoloop.abandoned_sessions.v1';
    final encoded = await _preferences.read(key);
    if (encoded == null || encoded.isEmpty) return <String>{};
    try {
      final decoded = jsonDecode(encoded);
      if (decoded is! List || decoded.any((value) => value is! String)) {
        throw const FormatException('Abandoned sessions are not an array');
      }
      return decoded.cast<String>().toSet();
    } on FormatException {
      await _preferences.remove(key);
      rethrow;
    }
  }

  Future<void> writeAbandonedSessions(Iterable<String> sessionIds) =>
      _preferences.write(
        'ecoloop.abandoned_sessions.v1',
        jsonEncode(sessionIds.toSet().toList()),
      );
}
