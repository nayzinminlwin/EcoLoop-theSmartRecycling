import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/providers/app_providers.dart';
import '../../domain/models/account_security_info.dart';
import '../../domain/models/password_change_request.dart';

final securityControllerProvider =
    AsyncNotifierProvider<SecurityController, AccountSecurityInfo>(
      SecurityController.new,
    );

class SecurityController extends AsyncNotifier<AccountSecurityInfo> {
  @override
  Future<AccountSecurityInfo> build() =>
      ref.watch(accountRepositoryProvider).getSecurityInfo();

  Future<void> change(PasswordChangeRequest request) async {
    final previous = state;
    state = AsyncLoading<AccountSecurityInfo>().copyWithPrevious(previous);
    final next = await AsyncValue.guard(
      () => ref.read(accountRepositoryProvider).changePassword(request),
    );
    state = next.hasError
        ? AsyncError<AccountSecurityInfo>(
            next.error!,
            next.stackTrace ?? StackTrace.current,
          ).copyWithPrevious(previous)
        : next;
  }
}
