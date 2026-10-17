import 'package:intl/intl.dart';

abstract final class AppFormatters {
  static final _date = DateFormat('d MMM yyyy');
  static final _points = NumberFormat.decimalPattern();
  static final _activityDay = DateFormat('d MMM');
  static final _activityTime = DateFormat('h:mm a');

  static String date(DateTime value) => _date.format(value);
  static String points(int value) => _points.format(value);
  static String weight(double value) {
    final formatted = value
        .toStringAsFixed(2)
        .replaceFirst(RegExp(r'\.?0+$'), '');
    return '$formatted kg';
  }

  static String dateTime(DateTime value) =>
      DateFormat('d MMM yyyy, h:mm a').format(value);

  /// Compact activity stamp: `Today, h:mm a` on the display-now calendar day,
  /// otherwise `d MMM, h:mm a`. Both arguments must already be converted to
  /// the demo display offset.
  static String activityStamp(DateTime displayOccurredAt, DateTime displayNow) {
    final sameDay =
        displayOccurredAt.year == displayNow.year &&
        displayOccurredAt.month == displayNow.month &&
        displayOccurredAt.day == displayNow.day;
    final time = _activityTime.format(displayOccurredAt);
    return sameDay
        ? 'Today, $time'
        : '${_activityDay.format(displayOccurredAt)}, $time';
  }

  /// Single place where a bin ID and location are joined, so the bin ID is
  /// never prepended twice when the location already carries it.
  static String location(String binId, String binLocation) {
    final location = binLocation.trim();
    final id = binId.trim();
    if (id.isEmpty || location.toLowerCase().startsWith(id.toLowerCase())) {
      return location;
    }
    return '$id · $location';
  }
}
