enum ExitIntentOperation { signOut, cancelSession }

enum ExitIntentState {
  locallyExited,
  awaitingDelivery,
  accepted,
  retryWait,
  resolved,
}

class ExitIntent {
  const ExitIntent({
    required this.id,
    required this.operation,
    required this.targetIdentity,
    required this.owner,
    required this.installationId,
    required this.authGeneration,
    required this.registrationGeneration,
    required this.createdAt,
    required this.state,
    required this.attemptCount,
    this.nextAttemptAt,
    this.serverAcceptanceReference,
    this.serverCompletionReference,
  });

  final String id;
  final ExitIntentOperation operation;
  final String targetIdentity;
  final String owner;
  final String installationId;
  final String authGeneration;
  final String registrationGeneration;
  final DateTime createdAt;
  final ExitIntentState state;
  final int attemptCount;
  final DateTime? nextAttemptAt;
  final String? serverAcceptanceReference;
  final String? serverCompletionReference;

  bool get isTerminal => state == ExitIntentState.resolved;

  ExitIntent copyWith({
    ExitIntentState? state,
    int? attemptCount,
    DateTime? nextAttemptAt,
    String? serverAcceptanceReference,
    String? serverCompletionReference,
    bool clearNextAttemptAt = false,
  }) {
    return ExitIntent(
      id: id,
      operation: operation,
      targetIdentity: targetIdentity,
      owner: owner,
      installationId: installationId,
      authGeneration: authGeneration,
      registrationGeneration: registrationGeneration,
      createdAt: createdAt,
      state: state ?? this.state,
      attemptCount: attemptCount ?? this.attemptCount,
      nextAttemptAt: clearNextAttemptAt
          ? null
          : nextAttemptAt ?? this.nextAttemptAt,
      serverAcceptanceReference:
          serverAcceptanceReference ?? this.serverAcceptanceReference,
      serverCompletionReference:
          serverCompletionReference ?? this.serverCompletionReference,
    );
  }

  Map<String, Object?> toJson() => <String, Object?>{
    'id': id,
    'operation': operation.name,
    'targetIdentity': targetIdentity,
    'owner': owner,
    'installationId': installationId,
    'authGeneration': authGeneration,
    'registrationGeneration': registrationGeneration,
    'createdAt': createdAt.toUtc().toIso8601String(),
    'state': state.name,
    'attemptCount': attemptCount,
    if (nextAttemptAt != null)
      'nextAttemptAt': nextAttemptAt!.toUtc().toIso8601String(),
    if (serverAcceptanceReference != null)
      'serverAcceptanceReference': serverAcceptanceReference,
    if (serverCompletionReference != null)
      'serverCompletionReference': serverCompletionReference,
  };

  static ExitIntent fromJson(Map<String, Object?> json) {
    final id = json['id'];
    final operation = json['operation'];
    final targetIdentity = json['targetIdentity'];
    final owner = json['owner'];
    final installationId = json['installationId'];
    final authGeneration = json['authGeneration'];
    final registrationGeneration = json['registrationGeneration'];
    final createdAt = json['createdAt'];
    final state = json['state'];
    final attemptCount = json['attemptCount'];
    if (id is! String ||
        operation is! String ||
        targetIdentity is! String ||
        owner is! String ||
        installationId is! String ||
        authGeneration is! String ||
        registrationGeneration is! String ||
        createdAt is! String ||
        state is! String ||
        attemptCount is! int) {
      throw const FormatException('Invalid exit intent');
    }

    DateTime parseDate(Object? value, String field) {
      if (value is! String) {
        throw FormatException('Invalid exit intent $field');
      }
      final parsed = DateTime.tryParse(value);
      if (parsed == null) {
        throw FormatException('Invalid exit intent $field');
      }
      return parsed.toUtc();
    }

    final operationValue = ExitIntentOperation.values
        .where((value) => value.name == operation)
        .firstOrNull;
    final stateValue = ExitIntentState.values
        .where((value) => value.name == state)
        .firstOrNull;
    if (operationValue == null || stateValue == null || attemptCount < 0) {
      throw const FormatException('Invalid exit intent enum or retry count');
    }

    final acceptanceReference = json['serverAcceptanceReference'];
    final completionReference = json['serverCompletionReference'];
    if (acceptanceReference != null && acceptanceReference is! String ||
        completionReference != null && completionReference is! String) {
      throw const FormatException('Invalid exit intent server reference');
    }

    return ExitIntent(
      id: id,
      operation: operationValue,
      targetIdentity: targetIdentity,
      owner: owner,
      installationId: installationId,
      authGeneration: authGeneration,
      registrationGeneration: registrationGeneration,
      createdAt: parseDate(createdAt, 'createdAt'),
      state: stateValue,
      attemptCount: attemptCount,
      nextAttemptAt: json['nextAttemptAt'] == null
          ? null
          : parseDate(json['nextAttemptAt'], 'nextAttemptAt'),
      serverAcceptanceReference: acceptanceReference as String?,
      serverCompletionReference: completionReference as String?,
    );
  }
}
