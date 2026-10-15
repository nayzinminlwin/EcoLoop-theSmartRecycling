import 'dart:async';

import '../data/app_failure.dart';
import 'mock_scenario.dart';

class MockApi {
  MockApi({
    MockScenarioState? scenario,
    this.readDelay = const Duration(milliseconds: 350),
    this.writeDelay = const Duration(milliseconds: 650),
    this.classificationDelay = const Duration(milliseconds: 1500),
  }) : scenario = scenario ?? MockScenarioState();

  final MockScenarioState scenario;
  final Duration readDelay;
  final Duration writeDelay;
  final Duration classificationDelay;

  Future<T> read<T>(String operation, FutureOr<T> Function() action) async {
    await Future<void>.delayed(readDelay);
    if (scenario.consumeReadFailure()) {
      throw const AppFailure(
        code: AppFailureCodes.unavailable,
        messageKey: 'mock.readUnavailable',
        retryable: true,
      );
    }
    return action();
  }

  Future<T> write<T>(String operation, FutureOr<T> Function() action) async {
    await Future<void>.delayed(writeDelay);
    return action();
  }
}
