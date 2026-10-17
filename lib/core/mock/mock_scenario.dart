enum MockScenario {
  normal,
  readFailureOnce,
  classificationFailureOnce,
  profileSaveFailureOnce,
  emptyActivity,
  redemptionFailureOnce,
}

class MockScenarioState {
  MockScenarioState({this.scenario = MockScenario.normal});

  MockScenario scenario;
  bool _readFailureConsumed = false;
  final Set<String> _operationFailuresConsumed = {};

  bool consumeReadFailure() {
    if (scenario != MockScenario.readFailureOnce || _readFailureConsumed) {
      return false;
    }
    _readFailureConsumed = true;
    return true;
  }

  bool consumeWriteFailure(String operation) {
    final shouldFail = switch (scenario) {
      MockScenario.classificationFailureOnce =>
        operation == 'scan.completeVerification',
      MockScenario.profileSaveFailureOnce =>
        operation == 'account.updateProfile',
      MockScenario.redemptionFailureOnce => operation == 'rewards.redeemReward',
      _ => false,
    };
    return shouldFail && _operationFailuresConsumed.add(operation);
  }
}
