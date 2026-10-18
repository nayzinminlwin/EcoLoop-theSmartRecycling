class AppFailure implements Exception {
  const AppFailure({
    required this.code,
    required this.messageKey,
    required this.retryable,
    this.requestId,
    this.traceId,
  });

  final String code;
  final String messageKey;
  final bool retryable;
  final String? requestId;
  final String? traceId;

  @override
  String toString() => 'AppFailure($code)';
}

abstract final class AppFailureCodes {
  static const unavailable = 'unavailable';
  static const invalidData = 'invalidData';
  static const notFound = 'notFound';
  static const validation = 'validation';
  static const conflict = 'conflict';
  static const insufficientPoints = 'insufficientPoints';
  static const invalidQr = 'invalidQr';
  static const binUnavailable = 'binUnavailable';
  static const invalidTransition = 'invalidTransition';
  static const unauthenticated = 'unauthenticated';
  static const permissionDenied = 'permissionDenied';
}
