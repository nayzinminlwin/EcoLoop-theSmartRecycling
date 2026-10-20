import 'package:eco_loop/core/mock/app_clock.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('retains a fixed clock for mock fixtures', () {
    final clock = AppClock(now: DateTime.utc(2024, 5, 20, 3));

    expect(clock.now, DateTime.utc(2024, 5, 20, 3));
    expect(clock.now, DateTime.utc(2024, 5, 20, 3));
  });

  test('system clock advances between now accesses', () async {
    final clock = AppClock.system();
    final first = clock.now;
    await Future<void>.delayed(const Duration(milliseconds: 2));
    final second = clock.now;

    expect(second.isAfter(first), isTrue);
  });

  test('system clock preserves display timezone configuration', () {
    final clock = AppClock.system(
      locale: 'en_MY',
      utcOffsetMinutes: 480,
    );

    expect(clock.locale, 'en_MY');
    expect(clock.utcOffsetMinutes, 480);
  });
}
