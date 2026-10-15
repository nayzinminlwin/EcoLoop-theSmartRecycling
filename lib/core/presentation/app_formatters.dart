import 'package:intl/intl.dart';

abstract final class AppFormatters {
  static final _date = DateFormat('d MMM yyyy');
  static final _points = NumberFormat.decimalPattern();

  static String date(DateTime value) => _date.format(value);
  static String points(int value) => _points.format(value);
  static String weight(double value) => '${value.toStringAsFixed(1)} kg';
}
