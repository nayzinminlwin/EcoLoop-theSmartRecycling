import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:eco_loop/shared/widgets/app_button.dart';
import 'package:eco_loop/shared/widgets/app_error_view.dart';
import 'package:eco_loop/shared/widgets/app_loading_view.dart';
import 'package:eco_loop/shared/widgets/app_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
        data: (voucher) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              voucher.title,
              style: Theme.of(context).textTheme.headlineMedium,
            ),
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
            Text('Status: ${voucher.status.wireValue}'),
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
          ],
        ),
      ),
    );
  }
}
