class AppClock {
  AppClock({DateTime? now, this.locale = 'en_MY', this.utcOffsetMinutes = 480})
    : _now = now ?? DateTime.parse('2024-05-20T11:00:00+08:00');

  factory AppClock.fromMetadata(
    Map<String, Object?> metadata, {
    DateTime? now,
  }) {
    final rawOffset = metadata['utcOffsetMinutes'];
    return AppClock(
      now:
          now ??
          (metadata['referenceNow'] is String
              ? DateTime.parse(metadata['referenceNow'] as String)
              : null),
      locale: metadata['locale'] as String? ?? 'en_MY',
      utcOffsetMinutes: rawOffset is num ? rawOffset.toInt() : 480,
    );
  }

  final DateTime _now;
  final String locale;
  final int utcOffsetMinutes;

  DateTime get now => _now;

  DateTime toDisplay(DateTime instant) =>
      instant.toUtc().add(Duration(minutes: utcOffsetMinutes));

  DateTime calendarDate(DateTime instant) {
    final displayed = toDisplay(instant);
    return DateTime(displayed.year, displayed.month, displayed.day);
  }
}
