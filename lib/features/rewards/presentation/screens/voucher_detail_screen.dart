import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/shared/widgets/app_button.dart';
import 'package:eco_loop/shared/widgets/app_error_view.dart';
import 'package:eco_loop/shared/widgets/app_loading_view.dart';
import 'package:eco_loop/shared/widgets/app_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dart:async';

import 'package:eco_loop/core/data/app_failure.dart';
import 'package:eco_loop/app/providers/app_providers.dart';

import '../../domain/models/resident_voucher.dart';
import '../controllers/vouchers_controller.dart';

class VoucherDetailScreen extends ConsumerWidget {
  const VoucherDetailScreen({required this.voucherId, super.key});
  final String voucherId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(voucherProvider(voucherId));
    return AppPage(
      child: state.when(
        loading: () => const AppLoadingView(message: 'Loading voucher'),
        error: (_, _) => AppErrorView(
          message: 'This voucher is not available.',
          onRetry: () => ref.invalidate(voucherProvider(voucherId)),
        ),
        data: (voucher) => voucher == null
            ? const AppErrorView(message: 'This voucher is not available.')
            : _VoucherDetail(
                voucher: voucher,
                onUsed: () => ref.invalidate(voucherProvider(voucherId)),
              ),
      ),
    );
  }
}

class _VoucherDetail extends ConsumerStatefulWidget {
  const _VoucherDetail({required this.voucher, required this.onUsed});
  final ResidentVoucher voucher;
  final VoidCallback onUsed;

  @override
  ConsumerState<_VoucherDetail> createState() => _VoucherDetailState();
}

class _VoucherDetailState extends ConsumerState<_VoucherDetail> {
  bool _using = false;
  String? _error;
  late final String _useRequestId =
      'use-${widget.voucher.id}-${DateTime.now().microsecondsSinceEpoch}';
  Timer? _expiryTimer;

  @override
  void initState() {
    super.initState();
    _expiryTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) widget.onUsed();
    });
  }

  @override
  void dispose() {
    _expiryTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final voucher = widget.voucher;
    final status = voucher.statusAt(ref.watch(systemAppClockProvider).now);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(voucher.title, style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 6),
        Text(
          voucher.merchantName,
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 22),
        Card(
          color: AppColors.mint,
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Center(
              child: Text(
                voucher.code,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        Text('Status: ${status.wireValue}'),
        Text('Remaining uses: ${voucher.remainingUses}'),
        Text(
          'Expires: ${MaterialLocalizations.of(context).formatMediumDate(voucher.expiresAt)}',
        ),
        const SizedBox(height: 16),
        Text(voucher.terms),
        const SizedBox(height: 20),
        AppButton(
          label: 'Copy code',
          leadingIcon: Icons.copy,
          onPressed: () async {
            await Clipboard.setData(ClipboardData(text: voucher.code));
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Voucher code copied.')),
              );
            }
          },
        ),
        if (voucher.demo && status == VoucherStatus.available) ...[
          const SizedBox(height: 12),
          AppButton(
            label: 'Simulate voucher use',
            pendingLabel: 'Marking voucher as used...',
            isLoading: _using,
            onPressed: _using ? null : _use,
          ),
        ],
        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(_error!, style: const TextStyle(color: Colors.red)),
        ],
      ],
    );
  }

  Future<void> _use() async {
    setState(() {
      _using = true;
      _error = null;
    });
    try {
      await ref
          .read(rewardsRepositoryProvider)
          .useDemoVoucher(widget.voucher.id, _useRequestId);
      if (!mounted) return;
      widget.onUsed();
      setState(() => _using = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Voucher marked as used.')));
    } on AppFailure catch (failure) {
      if (!mounted) return;
      setState(() {
        _using = false;
        _error = switch (failure.code) {
          'voucher_used' => 'This voucher has already been used.',
          'voucher_expired' => 'This voucher has expired.',
          _ => 'Voucher use could not be completed.',
        };
      });
    }
  }
}
