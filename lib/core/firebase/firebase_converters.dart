import 'package:cloud_firestore/cloud_firestore.dart';

DateTime? firestoreDate(Object? value) {
  if (value == null) return null;
  if (value is Timestamp) return value.toDate().toUtc();
  if (value is DateTime) return value.toUtc();
  if (value is String) {
    final parsed = DateTime.tryParse(value);
    if (parsed != null) return parsed.toUtc();
  }
  throw FormatException('Expected a Firestore timestamp, got ${value.runtimeType}');
}

DateTime firestoreRequiredDate(Object? value, String field) {
  final parsed = firestoreDate(value);
  if (parsed == null) throw FormatException('$field is required');
  return parsed;
}

Map<String, Object?> firestoreData(
  DocumentSnapshot<Map<String, dynamic>> snapshot,
) {
  final data = snapshot.data();
  if (data == null) throw StateError('Document ${snapshot.reference.path} does not exist');
  return Map<String, Object?>.from(data);
}

T? firestoreOptional<T>(
  Map<String, Object?> data,
  String field,
  T Function(Object? value) convert,
) {
  final value = data[field];
  return value == null ? null : convert(value);
}
