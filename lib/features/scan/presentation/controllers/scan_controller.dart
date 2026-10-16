import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:eco_loop/app/providers/app_providers.dart';

import '../../domain/models/deposit_session.dart';
import '../../domain/models/smart_bin.dart';

final scanBinProvider = FutureProvider.family<SmartBin, String>(
  (ref, payload) => ref.read(scanRepositoryProvider).lookupBin(payload),
);

final scanSessionProvider = FutureProvider.family<DepositSession, String>(
  (ref, id) => ref.read(scanRepositoryProvider).getSession(id),
);
