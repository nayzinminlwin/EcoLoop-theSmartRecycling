import 'package:eco_loop/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

import '../../domain/models/resident_voucher.dart';

class VoucherTile extends StatelessWidget {
  const VoucherTile({required this.voucher, required this.onTap, super.key});

  final ResidentVoucher voucher;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
    child: ListTile(
      leading: const CircleAvatar(
        backgroundColor: AppColors.sage,
        child: Icon(Icons.card_giftcard, color: AppColors.primary),
      ),
      title: Text(voucher.title),
      subtitle: Text('${voucher.merchantName} · ${voucher.status.wireValue}'),
      trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    ),
  );
}
