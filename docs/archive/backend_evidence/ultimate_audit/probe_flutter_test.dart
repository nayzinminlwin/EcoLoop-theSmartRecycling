import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:eco_loop/core/data/app_failure.dart';
import 'package:eco_loop/core/data/pending_operation_store.dart';
import 'package:eco_loop/core/domain/deposit_line_item.dart';
import 'package:eco_loop/core/firebase/command_client.dart';
import 'package:eco_loop/features/account/domain/models/resident_profile.dart';
import 'package:eco_loop/features/scan/data/backend_scan_mapper.dart';
import 'package:eco_loop/features/account/data/firebase_account_repository.dart';
import '../../../../test/features/account/firebase_auth_flow_test.dart' as fakes;

void main() {
  test('AUDIT: actual account writer shape is rejected by Flutter profile', () {
    expect(() => ResidentProfile.fromJson({
      'residentId':'audit-user','displayName':'Audit User','email':'audit@example.invalid',
      'avatarUrl':null,'role':'user','createdAt':'2026-10-20T01:00:00.000Z','updatedAt':'2026-10-20T01:00:00.000Z',
    }), throwsA(isA<AppFailure>()));
  });
  test('AUDIT: actual queued result document cannot be observed', () {
    expect(() => BackendScanMapper.resultFromJson({
      'id':'audit-result','ownerId':'audit-user','sessionId':'audit-session','batchId':'audit-batch',
      'outcome':'processing','pointsAwarded':null,'spaceContributionSpc':0,'decisionVersion':0,
      'explanation':'Your image is being checked.','createdAt':'2026-10-20T01:00:00.000Z',
    }), throwsA(isA<AppFailure>()));
  });
  test('AUDIT: canonical line class changes during round trip', () {
    final line = DepositLineItem.fromJson({'lineId':'bag','class':'paper_bag','eligible':true,'count':1,'points':3,'spaceSpc':8});
    expect(line.toJson()['class'], 'paper_item');
  });
  test('AUDIT: existing ready auth state is never replayed to Home subscriber', () async {
    final repository = FirebaseAccountRepository(
      auth:fakes.FakeAuthGateway(),
      google:fakes.FakeGoogleGateway(account:const GoogleAccount(email:'audit@example.invalid',displayName:'Audit',photoUrl:null,idToken:'test-only')),
      commandClient:(uid)=>CommandClient(uid:uid,store:PendingOperationStore(preferences:fakes.MemoryPreferences()),requestIdFactory:()=> 'audit-request-001',transport:(operation,payload)async=>{
        'schemaVersion':'backend.v1','operation':operation,'requestId':'audit-request-001',
        'traceId':'a'*32,'status':'committed','data':{'role':'user'},
      }),
    );
    await repository.signInWithGoogle();
    await expectLater(repository.watchAuthState().first.timeout(const Duration(milliseconds:100)),throwsA(isA<TimeoutException>()));
    await repository.dispose();
  });
  test('AUDIT: callable permission denial is replaced by retryable unavailable', () async {
    final client=CommandClient(uid:'audit-user',store:PendingOperationStore(preferences:fakes.MemoryPreferences()),transport:(operation,payload)async=>throw FirebaseFunctionsException(code:'permission-denied',message:'No permission',details:{'code':'permission_denied'}));
    await expectLater(client.execute('getResidentProfile',{}), throwsA(isA<AppFailure>().having((e)=>e.code,'code',AppFailureCodes.unavailable).having((e)=>e.retryable,'retryable',true)));
  });
}
