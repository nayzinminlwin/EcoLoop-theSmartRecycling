import 'package:eco_loop/core/data/json_readers.dart';

class DemoSession {
  const DemoSession({
    required this.id,
    required this.residentId,
    required this.isSignedIn,
    required this.startedAt,
  });

  final String id;
  final String residentId;
  final bool isSignedIn;
  final DateTime startedAt;

  DemoSession copyWith({bool? isSignedIn}) => DemoSession(
    id: id,
    residentId: residentId,
    isSignedIn: isSignedIn ?? this.isSignedIn,
    startedAt: startedAt,
  );

  factory DemoSession.fromJson(JsonMap json) => DemoSession(
    id: JsonReaders.string(json, 'id'),
    residentId: JsonReaders.string(json, 'residentId'),
    isSignedIn: JsonReaders.boolean(json, 'isSignedIn'),
    startedAt: JsonReaders.dateTime(json, 'startedAt'),
  );

  JsonMap toJson() => {
    'id': id,
    'residentId': residentId,
    'isSignedIn': isSignedIn,
    'startedAt': startedAt.toIso8601String(),
  };
}
