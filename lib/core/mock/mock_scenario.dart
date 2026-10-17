enum MockScenario {
  normal,
  readFailureOnce,
  classificationFailureOnce,
  profileSaveFailureOnce,
  emptyActivity,
  redemptionFailureOnce,
  reviewDeposit,
  rejectedDeposit,
  invalidQr,
  fullBin,
  emptyRewards,
  noVouchers,
  zeroBalance,
}

class MockScenarioState {
  MockScenarioState({
    this.scenario = MockScenario.normal,
    Set<String>? readFailuresOnce,
    Set<String>? writeFailuresOnce,
  }) : _readFailuresOnce = {...?readFailuresOnce},
       _writeFailuresOnce = {...?writeFailuresOnce};

  MockScenario scenario;
  final Set<String> _readFailuresOnce;
  final Set<String> _writeFailuresOnce;
  final Set<String> _operationFailuresConsumed = {};

  bool consumeReadFailure(String operation) {
    final targeted = _readFailuresOnce.contains(operation);
    final scenarioFailure =
        scenario == MockScenario.readFailureOnce &&
        _operationFailuresConsumed.add('read');
    return targeted || scenarioFailure;
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
    return (_writeFailuresOnce.contains(operation) || shouldFail) &&
        _operationFailuresConsumed.add(operation);
  }

  factory MockScenarioState.fromEnvironment() {
    const key = String.fromEnvironment('MOCK_SCENARIO', defaultValue: 'normal');
    final scenario = MockScenario.values.firstWhere(
      (item) => item.name == key,
      orElse: () => MockScenario.normal,
    );
    return MockScenarioState(scenario: scenario);
  }
}
