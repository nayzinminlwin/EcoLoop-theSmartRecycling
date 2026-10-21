import 'app_failure.dart';

import 'package:cloud_firestore/cloud_firestore.dart';

typedef JsonMap = Map<String, Object?>;

abstract final class JsonReaders {
  static AppFailure invalid(String field) => AppFailure(
    code: AppFailureCodes.invalidData,
    messageKey: 'invalidData.$field',
    retryable: false,
  );

  static JsonMap map(Object? value, String field) {
    if (value is Map<String, Object?>) return value;
    if (value is Map) {
      return value.map((key, value) => MapEntry(key.toString(), value));
    }
    throw invalid(field);
  }

  static String string(JsonMap json, String field) {
    final value = json[field];
    if (value is String && value.isNotEmpty) return value;
    throw invalid(field);
  }

  static String? nullableString(JsonMap json, String field) {
    final value = json[field];
    if (value == null) return null;
    if (value is String) return value;
    throw invalid(field);
  }

  static int integer(JsonMap json, String field) {
    final value = json[field];
    if (value is int) return value;
    if (value is num && value == value.roundToDouble()) return value.toInt();
    throw invalid(field);
  }

  static double number(JsonMap json, String field) {
    final value = json[field];
    if (value is num) return value.toDouble();
    throw invalid(field);
  }

  static bool boolean(JsonMap json, String field) {
    final value = json[field];
    if (value is bool) return value;
    throw invalid(field);
  }

  static DateTime dateTime(JsonMap json, String field) {
    final value = json[field];
    if (value is Timestamp) return value.toDate();
    if (value is String) {
      final parsed = DateTime.tryParse(value);
      if (parsed != null) return parsed;
    }
    if (value is Map) {
      final seconds = value['seconds'];
      final nanos = value['nanoseconds'] ?? 0;
      if (seconds is num && nanos is num) {
        return DateTime.fromMillisecondsSinceEpoch(
          seconds.toInt() * 1000 + nanos.toInt() ~/ 1000000,
          isUtc: true,
        );
      }
    }
    throw invalid(field);
  }

  static List<JsonMap> maps(JsonMap json, String field) {
    final value = json[field];
    if (value is List) {
      return value.map((item) => map(item, field)).toList(growable: false);
    }
    throw invalid(field);
  }

  static List<String> strings(JsonMap json, String field) {
    final value = json[field];
    if (value is List && value.every((item) => item is String)) {
      return value.cast<String>().toList(growable: false);
    }
    throw invalid(field);
  }
}
