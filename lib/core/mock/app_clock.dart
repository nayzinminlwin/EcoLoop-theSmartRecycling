class AppClock {
  AppClock({DateTime? now}) : _now = now ?? DateTime(2024, 5, 20, 11);

  final DateTime _now;

  DateTime get now => _now;
}
