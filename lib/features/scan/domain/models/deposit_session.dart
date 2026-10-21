import 'package:eco_loop/core/data/json_readers.dart';

enum ScanStage {
  binFound('binFound'),
  ready('ready'),
  itemDetected('itemDetected'),
  processing('processing'),
  completed('completed'),
  cancelled('cancelled');

  const ScanStage(this.wireValue);
  final String wireValue;
  static ScanStage fromWire(String value) => values.firstWhere(
    (item) => item.wireValue == value,
    orElse: () => ScanStage.cancelled,
  );
}

class ScanProgressSummary {
  const ScanProgressSummary({
    required this.phase,
    required this.activity,
    required this.revision,
    required this.attemptNumber,
    required this.completedStages,
    required this.submissionAt,
    required this.updatedAt,
    this.stageStartedAt,
    this.deadlineAt,
  });

  final String phase;
  final String activity;
  final int revision;
  final int attemptNumber;
  final List<String> completedStages;
  final DateTime submissionAt;
  final DateTime? stageStartedAt;
  final DateTime updatedAt;
  final DateTime? deadlineAt;

  factory ScanProgressSummary.fromJson(JsonMap json) => ScanProgressSummary(
    phase: JsonReaders.string(json, 'phase'),
    activity: JsonReaders.string(json, 'activity'),
    revision: JsonReaders.integer(json, 'revision'),
    attemptNumber: JsonReaders.integer(json, 'attemptNumber'),
    completedStages: JsonReaders.strings(json, 'completedStages'),
    submissionAt: JsonReaders.dateTime(json, 'submissionAt'),
    stageStartedAt: _dateOrNull(json, 'stageStartedAt'),
    updatedAt: JsonReaders.dateTime(json, 'updatedAt'),
    deadlineAt: _dateOrNull(json, 'deadlineAt'),
  );

  JsonMap toJson() => {
    'phase': phase,
    'activity': activity,
    'revision': revision,
    'attemptNumber': attemptNumber,
    'completedStages': completedStages,
    'submissionAt': submissionAt.toIso8601String(),
    'stageStartedAt': stageStartedAt?.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
    'deadlineAt': deadlineAt?.toIso8601String(),
  };

  static DateTime? _dateOrNull(JsonMap json, String field) =>
      json[field] == null ? null : JsonReaders.dateTime(json, field);
}

class DepositSession {
  const DepositSession({
    required this.id,
    required this.residentId,
    required this.binId,
    required this.stage,
    required this.createdAt,
    required this.updatedAt,
    required this.creationRequestId,
    this.resultId,
    this.sessionVersion = 0,
    this.draftAssetId,
    this.draftAssetVersion,
    this.committedAssetId,
    this.committedAssetVersion,
    this.committedAssetSha256,
    this.batchId,
    this.jobId,
    this.jobSubstage,
    this.progress,
    this.deadlineAt,
    this.reservationExpiresAt,
    this.terminationReason,
  });

  final String id;
  final String residentId;
  final String binId;
  final ScanStage stage;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String creationRequestId;
  final String? resultId;
  final int sessionVersion;
  final String? draftAssetId;
  final String? draftAssetVersion;
  final String? committedAssetId;
  final String? committedAssetVersion;
  final String? committedAssetSha256;
  final String? batchId;
  final String? jobId;
  final String? jobSubstage;
  final ScanProgressSummary? progress;
  final DateTime? deadlineAt;
  final DateTime? reservationExpiresAt;
  final String? terminationReason;

  factory DepositSession.fromJson(JsonMap json) => DepositSession(
    id: JsonReaders.string(json, 'id'),
    residentId: JsonReaders.string(json, 'residentId'),
    binId: JsonReaders.string(json, 'binId'),
    stage: ScanStage.fromWire(JsonReaders.string(json, 'stage')),
    createdAt: JsonReaders.dateTime(json, 'createdAt'),
    updatedAt: JsonReaders.dateTime(json, 'updatedAt'),
    creationRequestId: JsonReaders.string(json, 'creationRequestId'),
    resultId: JsonReaders.nullableString(json, 'resultId'),
  );

  factory DepositSession.fromBackendJson(JsonMap json) {
    if (JsonReaders.string(json, 'kind') != 'session' ||
        JsonReaders.string(json, 'schemaVersion') != 'backend.v1') {
      throw JsonReaders.invalid('snapshot');
    }
    final stageValue = JsonReaders.string(json, 'stage');
    final stage = ScanStage.values.where(
      (item) => item.wireValue == stageValue,
    );
    if (stage.isEmpty) throw JsonReaders.invalid('stage');
    return DepositSession(
      id: JsonReaders.string(json, 'sessionId'),
      residentId: JsonReaders.string(json, 'ownerId'),
      binId: JsonReaders.string(json, 'binId'),
      stage: stage.first,
      createdAt: JsonReaders.dateTime(json, 'createdAt'),
      updatedAt: JsonReaders.dateTime(json, 'updatedAt'),
      creationRequestId:
          JsonReaders.nullableString(json, 'creationRequestId') ??
          JsonReaders.string(json, 'sessionId'),
      resultId: JsonReaders.nullableString(json, 'resultId'),
      sessionVersion: JsonReaders.integer(json, 'version'),
      draftAssetId: JsonReaders.nullableString(json, 'draftAssetId'),
      draftAssetVersion: JsonReaders.nullableString(json, 'draftAssetVersion'),
      committedAssetId: JsonReaders.nullableString(json, 'assetId'),
      committedAssetVersion: JsonReaders.nullableString(json, 'assetVersion'),
      committedAssetSha256: JsonReaders.nullableString(
        json,
        'assetContentSha256',
      ),
      batchId: JsonReaders.nullableString(json, 'batchId'),
      jobId: JsonReaders.nullableString(json, 'jobId'),
      jobSubstage: JsonReaders.nullableString(json, 'jobSubstage'),
      progress: _progressOrNull(json),
      deadlineAt: _dateOrNull(json, 'deadlineAt'),
      reservationExpiresAt: _dateOrNull(json, 'reservationExpiresAt'),
      terminationReason: JsonReaders.nullableString(json, 'terminationReason'),
    );
  }

  JsonMap toJson() => {
    'id': id,
    'residentId': residentId,
    'binId': binId,
    'stage': stage.wireValue,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
    'creationRequestId': creationRequestId,
    'resultId': resultId,
    'version': sessionVersion,
    'draftAssetId': draftAssetId,
    'draftAssetVersion': draftAssetVersion,
    'assetId': committedAssetId,
    'assetVersion': committedAssetVersion,
    'assetContentSha256': committedAssetSha256,
    'batchId': batchId,
    'jobId': jobId,
    'jobSubstage': jobSubstage,
    'progress': progress?.toJson(),
    'deadlineAt': deadlineAt?.toIso8601String(),
    'reservationExpiresAt': reservationExpiresAt?.toIso8601String(),
    'terminationReason': terminationReason,
  };

  DepositSession copyWith({
    ScanStage? stage,
    DateTime? updatedAt,
    String? resultId,
    int? sessionVersion,
    String? draftAssetId,
    String? draftAssetVersion,
    String? committedAssetId,
    String? committedAssetVersion,
    String? committedAssetSha256,
    String? batchId,
    String? jobId,
    String? jobSubstage,
    ScanProgressSummary? progress,
    DateTime? deadlineAt,
    DateTime? reservationExpiresAt,
    String? terminationReason,
  }) => DepositSession(
    id: id,
    residentId: residentId,
    binId: binId,
    stage: stage ?? this.stage,
    createdAt: createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
    creationRequestId: creationRequestId,
    resultId: resultId ?? this.resultId,
    sessionVersion: sessionVersion ?? this.sessionVersion,
    draftAssetId: draftAssetId ?? this.draftAssetId,
    draftAssetVersion: draftAssetVersion ?? this.draftAssetVersion,
    committedAssetId: committedAssetId ?? this.committedAssetId,
    committedAssetVersion: committedAssetVersion ?? this.committedAssetVersion,
    committedAssetSha256: committedAssetSha256 ?? this.committedAssetSha256,
    batchId: batchId ?? this.batchId,
    jobId: jobId ?? this.jobId,
    jobSubstage: jobSubstage ?? this.jobSubstage,
    progress: progress ?? this.progress,
    deadlineAt: deadlineAt ?? this.deadlineAt,
    reservationExpiresAt: reservationExpiresAt ?? this.reservationExpiresAt,
    terminationReason: terminationReason ?? this.terminationReason,
  );

  static DateTime? _dateOrNull(JsonMap json, String field) {
    return json[field] == null ? null : JsonReaders.dateTime(json, field);
  }

  static ScanProgressSummary? _progressOrNull(JsonMap json) {
    final value = json['progress'];
    return value == null
        ? null
        : ScanProgressSummary.fromJson(JsonReaders.map(value, 'progress'));
  }
}
