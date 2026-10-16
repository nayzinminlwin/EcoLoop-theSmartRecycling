enum MockScenario {
  normal,
  readFailureOnce,
  emptyActivity,
  redemptionFailureOnce,
}

class MockScenarioState {
  MockScenarioState({this.scenario = MockScenario.normal});

  MockScenario scenario;
  bool _readFailureConsumed = false;

  bool consumeReadFailure() {
    if (scenario != MockScenario.readFailureOnce || _readFailureConsumed) {
      return false;
    }
    _readFailureConsumed = true;
    return true;
  }
}
