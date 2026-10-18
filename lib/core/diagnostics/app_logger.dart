// ignore_for_file: use_null_aware_elements

import 'dart:collection';

import 'package:flutter/foundation.dart';

typedef AppLogSink = void Function(String line);

enum AppLogLevel { debug, info, warning, error }

class AppLogContext {
  const AppLogContext({
    this.interactionId,
    this.requestId,
    this.traceId,
    this.sessionId,
    this.depositId,
  });

  final String? interactionId;
  final String? requestId;
  final String? traceId;
  final String? sessionId;
  final String? depositId;

  Map<String, Object> toJson() => <String, Object>{
        if (interactionId case final value?) 'interactionId': value,
        if (requestId case final value?) 'requestId': value,
        if (traceId case final value?) 'traceId': value,
        if (sessionId case final value?) 'sessionId': value,
        if (depositId case final value?) 'depositId': value,
      };
}

class AppLogger {
  AppLogger({
    String environment = 'debug',
    AppLogSink? sink,
    Duration throttleWindow = const Duration(seconds: 1),
    DateTime Function()? now,
  })  : _environment = environment, // ignore: prefer_initializing_formals
        _sink = sink ?? debugPrint,
        _throttleWindow = throttleWindow, // ignore: prefer_initializing_formals
        _now = now ?? DateTime.now;

  final String _environment;
  final AppLogSink _sink;
  final Duration _throttleWindow;
  final DateTime Function() _now;
  final Map<String, DateTime> _lastEmitted = <String, DateTime>{};
  AppLogContext _context = const AppLogContext();

  AppLogContext get context => _context;

  T withContext<T>(AppLogContext context, T Function() action) {
    final previous = _context;
    _context = context;
    try {
      return action();
    } finally {
      _context = previous;
    }
  }

  void log(
    AppLogLevel level,
    String event, {
    Map<String, Object?> fields = const <String, Object?>{},
    bool throttle = false,
  }) {
    if (throttle) {
      final previous = _lastEmitted[event];
      final now = _now();
      if (previous != null && now.difference(previous) < _throttleWindow) {
        return;
      }
      _lastEmitted[event] = now;
    }
    final data = <String, Object>{
      ..._context.toJson(),
      'timestamp': _now().toUtc().toIso8601String(),
      'severity': level.name.toUpperCase(),
      'event': event,
      'service': 'flutter',
      'environment': _environment,
      'schemaVersion': 1,
      ..._redactMap(fields),
    };
    _sink(data.entries.map((entry) => '${entry.key}=${entry.value}').join(' '));
  }

  void error(String event, Object error, {Map<String, Object?> fields = const <String, Object?>{}}) {
    log(
      AppLogLevel.error,
      event,
      fields: <String, Object?>{
        ...fields,
        'errorCode': error.runtimeType.toString(),
        'errorMessage': error.toString().substring(0, error.toString().length.clamp(0, 240)),
      },
    );
  }
}

Map<String, Object> _redactMap(Map<String, Object?> source) {
  final result = <String, Object>{};
  for (final entry in source.entries.take(64)) {
    final key = entry.key.toLowerCase();
    if (key.contains('token') ||
        key.contains('secret') ||
        key.contains('password') ||
        key.contains('voucher') ||
        key.contains('authorization')) {
      result[entry.key] = '[REDACTED]';
    } else if (entry.value != null) {
      result[entry.key] = entry.value!;
    }
  }
  return UnmodifiableMapView<String, Object>(result);
}
