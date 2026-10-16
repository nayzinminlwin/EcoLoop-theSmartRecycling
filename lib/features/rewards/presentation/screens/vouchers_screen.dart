import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/shared/widgets/app_error_view.dart';
import 'package:eco_loop/shared/widgets/app_loading_view.dart';
import 'package:eco_loop/shared/widgets/app_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../domain/models/resident_voucher.dart';
import '../controllers/vouchers_controller.dart';
import '../widgets/voucher_tile.dart';

class VouchersScreen extends ConsumerStatefulWidget {
  const VouchersScreen({this.status, super.key});
  final VoucherStatus? status;

  @override
  ConsumerState<VouchersScreen> createState() => _VouchersScreenState();
}

class _VouchersScreenState extends ConsumerState<VouchersScreen> {
  late VoucherStatus? _status = widget.status;

  @override
  Widget build(BuildContext context) {
    final vouchers = ref.watch(vouchersProvider(_status));
    return AppPage(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'My vouchers',
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            children: [
              _tab('Available', VoucherStatus.available),
              _tab('Used', VoucherStatus.used),
              _tab('Expired', VoucherStatus.expired),
            ],
          ),
          const SizedBox(height: 18),
          vouchers.when(
            loading: () => const AppLoadingView(message: 'Loading vouchers'),
            error: (_, _) => AppErrorView(
              message: 'Vouchers could not be loaded.',
              onRetry: () => ref.invalidate(vouchersProvider(_status)),
            ),
            data: (items) => items.isEmpty
                ? const Text('No vouchers in this category.')
                : Column(
                    children: items
                        .map(
                          (voucher) => VoucherTile(
                            voucher: voucher,
                            onTap: () => context.push(
                              '${AppRoutes.vouchers}/${voucher.id}',
                            ),
                          ),
                        )
                        .toList(),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _tab(String label, VoucherStatus status) => ChoiceChip(
    label: Text(label),
    selected: _status == status,
    onSelected: (_) {
      setState(() => _status = status);
      context.go('${AppRoutes.vouchers}?status=${status.wireValue}');
    },
  );
}
