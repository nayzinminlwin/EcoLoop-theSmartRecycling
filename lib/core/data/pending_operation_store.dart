import 'dart:convert';
import 'dart:math';

import 'package:shared_preferences/shared_preferences.dart';

class PendingOperation {
  const PendingOperation({
    required this.uid,
    required this.operation,
    required this.requestId,
    required this.payload,
  });

  final String uid;
  final String operation;
  final String requestId;
  final Map<String, Object?> payload;

  Map<String, Object?> toJson() => <String, Object?>{
    'uid': uid,
    'operation': operation,
    'requestId': requestId,
    'payload': payload,
  };

  static PendingOperation fromJson(Map<String, Object?> json) {
    final uid = json['uid'];
    final operation = json['operation'];
    final requestId = json['requestId'];
    final payload = json['payload'];
    if (uid is! String ||
        operation is! String ||
        requestId is! String ||
        payload is! Map) {
      throw const FormatException('Invalid pending operation');
    }
    return PendingOperation(
      uid: uid,
      operation: operation,
      requestId: requestId,
      payload: Map<String, Object?>.from(payload),
    );
  }
}

abstract interface class PendingOperationPreferences {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> remove(String key);
}

class SharedPreferencesOperationPreferences
    implements PendingOperationPreferences {
  SharedPreferencesOperationPreferences({SharedPreferencesAsync? preferences})
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

class PendingOperationStore {
  PendingOperationStore({PendingOperationPreferences? preferences})
    : _preferences = preferences ?? SharedPreferencesOperationPreferences();

  static const _prefix = 'ecoloop.pending_operation.v1';
  final PendingOperationPreferences _preferences;

  Future<PendingOperation?> read(String uid) async {
    final encoded = await _preferences.read(_key(uid));
    if (encoded == null) return null;
    try {
      final decoded = jsonDecode(encoded);
      if (decoded is! Map) {
        throw const FormatException('Pending operation is not an object');
      }
      final operation = PendingOperation.fromJson(
        Map<String, Object?>.from(decoded),
      );
      if (operation.uid != uid) {
        throw const FormatException('Pending operation owner mismatch');
      }
      return operation;
    } on FormatException {
      await clear(uid);
      rethrow;
    }
  }

  Future<void> save(PendingOperation operation) async {
    await _preferences.write(
      _key(operation.uid),
      jsonEncode(operation.toJson()),
    );
  }

  Future<void> clear(String uid) => _preferences.remove(_key(uid));

  Future<String> installationId() async {
    final existing = await _preferences.read(_installationKey);
    if (existing != null && existing.isNotEmpty) return existing;
    final random = Random.secure();
    final value = List<String>.generate(
      32,
      (_) => random.nextInt(16).toRadixString(16),
    ).join();
    await _preferences.write(_installationKey, value);
    return value;
  }

  String _key(String uid) => '$_prefix.$uid';
  static const _installationKey = '$_prefix.installation_id';
}
