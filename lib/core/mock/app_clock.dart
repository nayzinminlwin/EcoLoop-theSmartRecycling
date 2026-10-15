class AppClock {
  AppClock({DateTime? now})
    : _now = now ?? DateTime.parse('2024-05-20T11:00:00+08:00');

  final DateTime _now;

  DateTime get now => _now;
}
