import '../models/deposit_result.dart';
import '../models/deposit_session.dart';
import '../models/scan_instructions.dart';
import '../models/smart_bin.dart';

abstract interface class ScanRepository {
  Future<ScanInstructions> getInstructions();
  Future<String> getDemoQrPayload();
  Future<SmartBin> lookupBin(String qrPayload);
  Future<SmartBin> getBin(String binId);
  Future<DepositSession> createSession(String binId, String requestId);
  Future<DepositSession> getSession(String sessionId);
  Future<DepositResult> getResult(String resultId);
  Future<DepositSession> confirmSession(String sessionId);
  Future<DepositSession> reportFinishPressed(String sessionId);
  Future<DepositSession> startVerification(String sessionId);
  Future<DepositSession> completeVerification(String sessionId);
  Future<DepositSession> cancelSession(String sessionId);
  Stream<SmartBin?> watchBin(String binId);
  Stream<DepositSession?> watchSession(String sessionId);
  Stream<DepositResult?> watchResult(String resultId);

  /// Synchronous store-backed peek used by route redirects to canonicalize
  /// stale/future-stage URLs to the committed stage state.
  ScanStage? peekSessionStage(String sessionId);
}
