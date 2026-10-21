import 'package:eco_loop/app/router/app_routes.dart';
import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/core/theme/app_typography.dart';
import 'package:eco_loop/shared/widgets/app_error_view.dart';
import 'package:eco_loop/shared/widgets/app_loading_view.dart';
import 'package:eco_loop/shared/widgets/app_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'dart:async';

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
  Timer? _expiryTimer;

  @override
  void initState() {
    super.initState();
    _expiryTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) ref.invalidate(vouchersProvider(_status));
    });
  }

  @override
  void dispose() {
    _expiryTimer?.cancel();
    super.dispose();
  }

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
            spacing: 16,
            runSpacing: 12,
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

  Widget _tab(String label, VoucherStatus status) {
    final selected = _status == status;
    return ChoiceChip(
      label: Text(label),
      labelStyle: AppTypography.textTheme.labelMedium!.copyWith(
        color: selected ? AppColors.primaryDark : AppColors.text,
      ),
      selected: selected,
      selectedColor: AppColors.sage,
      backgroundColor: AppColors.mint,
      checkmarkColor: AppColors.primaryDark,
      side: selected
          ? const BorderSide(color: AppColors.primaryDark)
          : BorderSide.none,
      onSelected: (_) {
        setState(() => _status = status);
        context.go('${AppRoutes.vouchers}?status=${status.wireValue}');
      },
    );
  }
}
