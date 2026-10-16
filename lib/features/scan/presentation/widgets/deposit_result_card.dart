import 'package:flutter/material.dart';

import '../../domain/models/deposit_result.dart';

class DepositResultCard extends StatelessWidget {
  const DepositResultCard({super.key, required this.result});
  final DepositResult result;

  @override
  Widget build(BuildContext context) {
    final title = switch (result.outcome) {
      DepositOutcome.verified => 'Deposit verified',
      DepositOutcome.review => 'Deposit pending review',
      DepositOutcome.rejected => 'Deposit not eligible',
      DepositOutcome.unknown => 'Deposit outcome unknown',
    };
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 12),
            Text(result.explanation),
            const SizedBox(height: 12),
            Text(
              result.pointsAwarded == null
                  ? 'No points awarded'
                  : '+${result.pointsAwarded} EcoPoints',
              style: Theme.of(context).textTheme.titleLarge,
            ),
          ],
        ),
      ),
    );
  }
}
