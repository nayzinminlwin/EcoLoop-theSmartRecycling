import 'package:eco_loop/core/data/json_readers.dart';

class NotificationPreferences {
  const NotificationPreferences({
    required this.residentId,
    required this.recyclingUpdates,
    required this.pointsCredits,
    required this.rewardReminders,
    required this.updatedAt,
  });

  final String residentId;
  final bool recyclingUpdates;
  final bool pointsCredits;
  final bool rewardReminders;
  final DateTime updatedAt;

  factory NotificationPreferences.fromJson(JsonMap json) =>
      NotificationPreferences(
        residentId: JsonReaders.string(json, 'residentId'),
        recyclingUpdates: JsonReaders.boolean(json, 'recyclingUpdates'),
        pointsCredits: JsonReaders.boolean(json, 'pointsCredits'),
        rewardReminders: JsonReaders.boolean(json, 'rewardReminders'),
        updatedAt: JsonReaders.dateTime(json, 'updatedAt'),
      );

  JsonMap toJson() => {
    'residentId': residentId,
    'recyclingUpdates': recyclingUpdates,
    'pointsCredits': pointsCredits,
    'rewardReminders': rewardReminders,
    'updatedAt': updatedAt.toIso8601String(),
  };
}
